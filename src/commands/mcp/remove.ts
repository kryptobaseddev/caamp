/**
 * mcp remove command
 */

import type { Command } from "commander";
import pc from "picocolors";
import { getInstalledProviders } from "../../core/registry/detection.js";
import { getProvider } from "../../core/registry/providers.js";
import { removeMcpServer } from "../../core/mcp/reader.js";
import { removeMcpFromLock } from "../../core/mcp/lock.js";
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

      const scope = opts.global ? "global" as const : "project" as const;
      let removed = 0;

      for (const provider of providers) {
        const success = await removeMcpServer(provider, name, scope);
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
