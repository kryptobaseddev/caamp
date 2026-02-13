/**
 * instructions check command
 */

import type { Command } from "commander";
import pc from "picocolors";
import { checkAllInjections } from "../../core/instructions/injector.js";
import { getInstalledProviders } from "../../core/registry/detection.js";
import { getAllProviders, getProvider } from "../../core/registry/providers.js";
import type { Provider } from "../../types.js";

export function registerInstructionsCheck(parent: Command): void {
  parent
    .command("check")
    .description("Check injection status across providers")
    .option("-a, --agent <name>", "Check specific agent(s)", (v, prev: string[]) => [...prev, v], [])
    .option("-g, --global", "Check global instruction files")
    .option("--json", "Output as JSON")
    .option("--all", "Check all known providers")
    .action(async (opts: {
      agent: string[];
      global?: boolean;
      json?: boolean;
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

      const scope = opts.global ? "global" as const : "project" as const;
      const results = await checkAllInjections(providers, process.cwd(), scope);

      if (opts.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      console.log(pc.bold(`\nInstruction file status (${scope}):\n`));

      for (const r of results) {
        let icon: string;
        let label: string;

        switch (r.status) {
          case "current":
            icon = pc.green("✓");
            label = "current";
            break;
          case "outdated":
            icon = pc.yellow("~");
            label = "outdated";
            break;
          case "missing":
            icon = pc.red("✗");
            label = "missing";
            break;
          case "none":
            icon = pc.dim("-");
            label = "no injection";
            break;
        }

        console.log(`  ${icon} ${r.file.padEnd(40)} ${label}`);
      }

      console.log();
    });
}
