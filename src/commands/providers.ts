/**
 * providers list|detect|show commands - LAFS-compliant with JSON-first output
 */

import { randomUUID } from "node:crypto";
import type { LAFSErrorCategory } from "@cleocode/lafs-protocol";
import { resolveOutputFormat } from "@cleocode/lafs-protocol";
import type { Command } from "commander";
import pc from "picocolors";
import { isHuman } from "../core/logger.js";
import { detectAllProviders, detectProjectProviders } from "../core/registry/detection.js";
import {
  getAllProviders,
  getProvider,
  getProviderCount,
  getProvidersByPriority,
  getRegistryVersion,
} from "../core/registry/providers.js";

interface LAFSErrorShape {
  code: string;
  message: string;
  category: LAFSErrorCategory;
  retryable: boolean;
  retryAfterMs: number | null;
  details: Record<string, unknown>;
}

export function registerProvidersCommand(program: Command): void {
  const providers = program
    .command("providers")
    .description("Manage AI agent providers");

  providers
    .command("list")
    .description("List all supported providers")
    .option("--json", "Output as JSON (default)")
    .option("--human", "Output in human-readable format")
    .option("--tier <tier>", "Filter by priority tier (high, medium, low)")
    .action(async (opts: { json?: boolean; human?: boolean; tier?: string }) => {
      const operation = "providers.list";
      const mvi = true;

      let format: "json" | "human";
      try {
        format = resolveOutputFormat({
          jsonFlag: opts.json ?? false,
          humanFlag: (opts.human ?? false) || isHuman(),
          projectDefault: "json",
        }).format;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        emitJsonError(operation, mvi, "E_FORMAT_CONFLICT", message, "VALIDATION");
        process.exit(1);
      }

      const all = opts.tier
        ? getProvidersByPriority(opts.tier as "high" | "medium" | "low")
        : getAllProviders();

      if (format === "json") {
        const envelope = buildEnvelope(
          operation,
          mvi,
          {
            providers: all,
            count: all.length,
            version: getRegistryVersion(),
            tier: opts.tier || null,
          },
          null,
        );
        console.log(JSON.stringify(envelope, null, 2));
        return;
      }

      // Human-readable output
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
    .option("--json", "Output as JSON (default)")
    .option("--human", "Output in human-readable format")
    .option("--project", "Include project-level detection")
    .action(async (opts: { json?: boolean; human?: boolean; project?: boolean }) => {
      const operation = "providers.detect";
      const mvi = true;

      let format: "json" | "human";
      try {
        format = resolveOutputFormat({
          jsonFlag: opts.json ?? false,
          humanFlag: (opts.human ?? false) || isHuman(),
          projectDefault: "json",
        }).format;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        emitJsonError(operation, mvi, "E_FORMAT_CONFLICT", message, "VALIDATION");
        process.exit(1);
      }

      const results = opts.project
        ? detectProjectProviders(process.cwd())
        : detectAllProviders();

      const installed = results.filter((r) => r.installed);

      if (format === "json") {
        const envelope = buildEnvelope(
          operation,
          mvi,
          {
            installed: installed.map((r) => ({
              id: r.provider.id,
              toolName: r.provider.toolName,
              methods: r.methods,
              projectDetected: r.projectDetected,
            })),
            notInstalled: results.filter((r) => !r.installed).map((r) => r.provider.id),
            count: {
              installed: installed.length,
              total: results.length,
            },
          },
          null,
        );
        console.log(JSON.stringify(envelope, null, 2));
        return;
      }

      // Human-readable output
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
    .option("--json", "Output as JSON (default)")
    .option("--human", "Output in human-readable format")
    .action(async (id: string, opts: { json?: boolean; human?: boolean }) => {
      const operation = "providers.show";
      const mvi = true;

      let format: "json" | "human";
      try {
        format = resolveOutputFormat({
          jsonFlag: opts.json ?? false,
          humanFlag: (opts.human ?? false) || isHuman(),
          projectDefault: "json",
        }).format;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        emitJsonError(operation, mvi, "E_FORMAT_CONFLICT", message, "VALIDATION");
        process.exit(1);
      }

      const provider = getProvider(id);

      if (!provider) {
        const message = `Provider not found: ${id}`;
        if (format === "json") {
          emitJsonError(operation, mvi, "E_PROVIDER_NOT_FOUND", message, "NOT_FOUND", {
            id,
          });
        } else {
          console.error(pc.red(message));
        }
        process.exit(1);
      }

      if (format === "json") {
        const envelope = buildEnvelope(
          operation,
          mvi,
          {
            provider,
          },
          null,
        );
        console.log(JSON.stringify(envelope, null, 2));
        return;
      }

      // Human-readable output
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

function buildEnvelope<T>(
  operation: string,
  mvi: boolean,
  result: T | null,
  error: LAFSErrorShape | null,
) {
  return {
    $schema: "https://lafs.dev/schemas/v1/envelope.schema.json" as const,
    _meta: {
      specVersion: "1.0.0",
      schemaVersion: "1.0.0",
      timestamp: new Date().toISOString(),
      operation,
      requestId: randomUUID(),
      transport: "cli" as const,
      strict: true,
      mvi,
      contextVersion: 0,
    },
    success: error === null,
    result,
    error,
    page: null,
  };
}

function emitJsonError(
  operation: string,
  mvi: boolean,
  code: string,
  message: string,
  category: LAFSErrorCategory,
  details: Record<string, unknown> = {},
): void {
  const envelope = buildEnvelope(operation, mvi, null, {
    code,
    message,
    category,
    retryable: false,
    retryAfterMs: null,
    details,
  });
  console.error(JSON.stringify(envelope, null, 2));
}
