/**
 * config show|path commands
 */

import { Command } from "commander";
import pc from "picocolors";
import { getProvider } from "../core/registry/providers.js";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { readConfig } from "../core/formats/index.js";

export function registerConfigCommand(program: Command): void {
  const config = program
    .command("config")
    .description("View provider configuration");

  config
    .command("show")
    .description("Show provider configuration")
    .argument("<provider>", "Provider ID or alias")
    .option("-g, --global", "Show global config")
    .option("--json", "Output as JSON")
    .action(async (providerId: string, opts: { global?: boolean; json?: boolean }) => {
      const provider = getProvider(providerId);

      if (!provider) {
        console.error(pc.red(`Provider not found: ${providerId}`));
        process.exit(1);
      }

      const configPath = opts.global
        ? provider.configPathGlobal
        : provider.configPathProject
          ? join(process.cwd(), provider.configPathProject)
          : provider.configPathGlobal;

      if (!existsSync(configPath)) {
        console.log(pc.dim(`No config file at: ${configPath}`));
        return;
      }

      try {
        const data = await readConfig(configPath, provider.configFormat);

        if (opts.json) {
          console.log(JSON.stringify(data, null, 2));
        } else {
          console.log(pc.bold(`\n${provider.toolName} config (${configPath}):\n`));
          console.log(JSON.stringify(data, null, 2));
        }
      } catch (err) {
        console.error(pc.red(`Error reading config: ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
      }
    });

  config
    .command("path")
    .description("Show config file path")
    .argument("<provider>", "Provider ID or alias")
    .argument("[scope]", "Scope: project (default) or global", "project")
    .action((providerId: string, scope: string) => {
      const provider = getProvider(providerId);

      if (!provider) {
        console.error(pc.red(`Provider not found: ${providerId}`));
        process.exit(1);
      }

      if (scope === "global") {
        console.log(provider.configPathGlobal);
      } else {
        if (provider.configPathProject) {
          console.log(join(process.cwd(), provider.configPathProject));
        } else {
          console.log(pc.dim(`${provider.toolName} has no project-level config`));
          console.log(provider.configPathGlobal);
        }
      }
    });
}
