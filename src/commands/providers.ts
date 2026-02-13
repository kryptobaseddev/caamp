/**
 * providers list|detect|show commands
 */

import type { Command } from "commander";
import pc from "picocolors";
import {
  getAllProviders,
  getProvider,
  getProviderCount,
  getRegistryVersion,
  getProvidersByPriority,
} from "../core/registry/providers.js";
import { detectAllProviders, detectProjectProviders } from "../core/registry/detection.js";

export function registerProvidersCommand(program: Command): void {
  const providers = program
    .command("providers")
    .description("Manage AI agent providers");

  providers
    .command("list")
    .description("List all supported providers")
    .option("--json", "Output as JSON")
    .option("--tier <tier>", "Filter by priority tier (high, medium, low)")
    .action(async (opts: { json?: boolean; tier?: string }) => {
      const all = opts.tier
        ? getProvidersByPriority(opts.tier as "high" | "medium" | "low")
        : getAllProviders();

      if (opts.json) {
        console.log(JSON.stringify(all, null, 2));
        return;
      }

      console.log(pc.bold(`\nCAMP Provider Registry v${getRegistryVersion()}`));
      console.log(pc.dim(`${getProviderCount()} providers\n`));

      // Group by priority
      const tiers = ["high", "medium", "low"] as const;
      for (const tier of tiers) {
        const tierProviders = all.filter((p) => p.priority === tier);
        if (tierProviders.length === 0) continue;

        const tierLabel = tier === "high" ? pc.green("HIGH") : tier === "medium" ? pc.yellow("MEDIUM") : pc.dim("LOW");
        console.log(`${tierLabel} priority:`);

        for (const p of tierProviders) {
          const status = p.status === "active"
            ? pc.green("active")
            : p.status === "beta"
              ? pc.yellow("beta")
              : pc.dim(p.status);

          console.log(`  ${pc.bold(p.agentFlag.padEnd(20))} ${p.toolName.padEnd(22)} ${p.vendor.padEnd(16)} [${status}]`);
        }
        console.log();
      }
    });

  providers
    .command("detect")
    .description("Auto-detect installed providers")
    .option("--json", "Output as JSON")
    .option("--project", "Include project-level detection")
    .action(async (opts: { json?: boolean; project?: boolean }) => {
      const results = opts.project
        ? detectProjectProviders(process.cwd())
        : detectAllProviders();

      const installed = results.filter((r) => r.installed);

      if (opts.json) {
        console.log(JSON.stringify(installed.map((r) => ({
          id: r.provider.id,
          toolName: r.provider.toolName,
          methods: r.methods,
          projectDetected: r.projectDetected,
        })), null, 2));
        return;
      }

      console.log(pc.bold(`\nDetected ${installed.length} installed providers:\n`));

      for (const r of installed) {
        const methods = r.methods.join(", ");
        const project = r.projectDetected ? pc.green(" [project]") : "";
        console.log(`  ${pc.green("✓")} ${pc.bold(r.provider.toolName.padEnd(22))} via ${pc.dim(methods)}${project}`);
      }

      const notInstalled = results.filter((r) => !r.installed);
      if (notInstalled.length > 0) {
        console.log(pc.dim(`\n  ${notInstalled.length} providers not detected`));
      }

      console.log();
    });

  providers
    .command("show")
    .description("Show provider details")
    .argument("<id>", "Provider ID or alias")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts: { json?: boolean }) => {
      const provider = getProvider(id);

      if (!provider) {
        console.error(pc.red(`Provider not found: ${id}`));
        process.exit(1);
      }

      if (opts.json) {
        console.log(JSON.stringify(provider, null, 2));
        return;
      }

      console.log(pc.bold(`\n${provider.toolName}`));
      console.log(pc.dim(`by ${provider.vendor}\n`));

      console.log(`  ID:              ${provider.id}`);
      console.log(`  Flag:            --agent ${provider.agentFlag}`);
      if (provider.aliases.length > 0) {
        console.log(`  Aliases:         ${provider.aliases.join(", ")}`);
      }
      console.log(`  Status:          ${provider.status}`);
      console.log(`  Priority:        ${provider.priority}`);
      console.log();
      console.log(`  Instruction:     ${provider.instructFile}`);
      console.log(`  Config format:   ${provider.configFormat}`);
      console.log(`  Config key:      ${provider.configKey}`);
      console.log(`  Transports:      ${provider.supportedTransports.join(", ")}`);
      console.log(`  Headers:         ${provider.supportsHeaders ? "yes" : "no"}`);
      console.log();
      console.log(pc.dim("  Paths:"));
      console.log(`  Global dir:      ${provider.pathGlobal}`);
      console.log(`  Project dir:     ${provider.pathProject || "(none)"}`);
      console.log(`  Global config:   ${provider.configPathGlobal}`);
      console.log(`  Project config:  ${provider.configPathProject || "(none)"}`);
      console.log(`  Global skills:   ${provider.pathSkills}`);
      console.log(`  Project skills:  ${provider.pathProjectSkills || "(none)"}`);
      console.log();
    });
}
