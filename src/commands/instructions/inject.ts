/**
 * instructions inject command
 */

import { Command } from "commander";
import pc from "picocolors";
import { injectAll } from "../../core/instructions/injector.js";
import { generateInjectionContent, groupByInstructFile } from "../../core/instructions/templates.js";
import { getInstalledProviders } from "../../core/registry/detection.js";
import { getAllProviders, getProvider } from "../../core/registry/providers.js";
import type { Provider } from "../../types.js";

export function registerInstructionsInject(parent: Command): void {
  parent
    .command("inject")
    .description("Inject instruction blocks into all provider files")
    .option("-a, --agent <name>", "Target specific agent(s)", (v, prev: string[]) => [...prev, v], [])
    .option("-g, --global", "Inject into global instruction files")
    .option("--content <text>", "Custom content to inject")
    .option("--dry-run", "Preview without writing")
    .option("--all", "Target all known providers")
    .action(async (opts: {
      agent: string[];
      global?: boolean;
      content?: string;
      dryRun?: boolean;
      all?: boolean;
    }) => {
      let providers: Provider[];

      if (opts.all) {
        providers = getAllProviders();
      } else if (opts.agent.length > 0) {
        providers = opts.agent
          .map((a) => getProvider(a))
          .filter((p): p is Provider => p !== undefined);
      } else {
        providers = getInstalledProviders();
      }

      if (providers.length === 0) {
        console.error(pc.red("No providers found."));
        process.exit(1);
      }

      const content = opts.content ?? generateInjectionContent();
      const scope = opts.global ? "global" as const : "project" as const;

      // Show grouped preview
      const groups = groupByInstructFile(providers);

      if (opts.dryRun) {
        console.log(pc.bold("Dry run - would inject into:\n"));
        for (const [file, group] of groups) {
          console.log(`  ${pc.bold(file)}: ${group.map((p) => p.id).join(", ")}`);
        }
        console.log(pc.dim(`\n  Scope: ${scope}`));
        console.log(pc.dim(`  Content length: ${content.length} chars`));
        return;
      }

      const results = await injectAll(providers, process.cwd(), scope, content);

      for (const [file, action] of results) {
        const icon = action === "created" ? pc.green("+")
          : action === "updated" ? pc.yellow("~")
            : pc.blue("^");
        console.log(`  ${icon} ${file} (${action})`);
      }

      console.log(pc.bold(`\n${results.size} file(s) processed.`));
    });
}
