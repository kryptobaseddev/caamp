/**
 * mcp remove command
 */

import { Command } from "commander";
import pc from "picocolors";
import { getInstalledProviders } from "../../core/registry/detection.js";
import { getProvider } from "../../core/registry/providers.js";
import { readConfig } from "../../core/formats/index.js";
import { removeJsonConfig } from "../../core/formats/json.js";
import { removeYamlConfig } from "../../core/formats/yaml.js";
import { removeTomlConfig } from "../../core/formats/toml.js";
import { removeMcpFromLock } from "../../core/mcp/lock.js";
import { join } from "node:path";
import type { Provider } from "../../types.js";

export function registerMcpRemove(parent: Command): void {
  parent
    .command("remove")
    .description("Remove MCP server from agent configs")
    .argument("<name>", "MCP server name to remove")
    .option("-a, --agent <name>", "Target specific agent(s)", (v, prev: string[]) => [...prev, v], [])
    .option("-g, --global", "Remove from global config")
    .option("--all", "Remove from all detected agents")
    .action(async (name: string, opts: {
      agent: string[];
      global?: boolean;
      all?: boolean;
    }) => {
      let providers: Provider[];

      if (opts.all) {
        providers = getInstalledProviders();
      } else if (opts.agent.length > 0) {
        providers = opts.agent
          .map((a) => getProvider(a))
          .filter((p): p is Provider => p !== undefined);
      } else {
        providers = getInstalledProviders();
      }

      let removed = 0;

      for (const provider of providers) {
        const configPath = opts.global
          ? provider.configPathGlobal
          : provider.configPathProject
            ? join(process.cwd(), provider.configPathProject)
            : null;

        if (!configPath) continue;

        let success = false;

        switch (provider.configFormat) {
          case "json":
          case "jsonc":
            success = await removeJsonConfig(configPath, provider.configKey, name);
            break;
          case "yaml":
            success = await removeYamlConfig(configPath, provider.configKey, name);
            break;
          case "toml":
            success = await removeTomlConfig(configPath, provider.configKey, name);
            break;
        }

        if (success) {
          console.log(`  ${pc.green("✓")} Removed from ${provider.toolName}`);
          removed++;
        }
      }

      if (removed > 0) {
        await removeMcpFromLock(name);
        console.log(pc.green(`\n✓ Removed "${name}" from ${removed} provider(s).`));
      } else {
        console.log(pc.yellow(`Server "${name}" not found in any provider config.`));
      }
    });
}
