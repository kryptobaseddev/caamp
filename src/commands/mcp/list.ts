/**
 * mcp list command
 */

import { Command } from "commander";
import pc from "picocolors";
import { getInstalledProviders } from "../../core/registry/detection.js";
import { getProvider } from "../../core/registry/providers.js";
import { listMcpServers } from "../../core/mcp/reader.js";
import type { McpServerEntry } from "../../types.js";

export function registerMcpList(parent: Command): void {
  parent
    .command("list")
    .description("List configured MCP servers")
    .option("-a, --agent <name>", "List for specific agent")
    .option("-g, --global", "List global config")
    .option("--json", "Output as JSON")
    .action(async (opts: { agent?: string; global?: boolean; json?: boolean }) => {
      const providers = opts.agent
        ? [getProvider(opts.agent)].filter((p): p is NonNullable<typeof p> => p !== undefined)
        : getInstalledProviders();

      const allEntries: McpServerEntry[] = [];

      for (const provider of providers) {
        // With --global, use global. Otherwise use project if provider supports it, else global.
        const scope: "project" | "global" = opts.global
          ? "global"
          : provider.configPathProject
            ? "project"
            : "global";

        const entries = await listMcpServers(provider, scope);
        allEntries.push(...entries);
      }

      if (opts.json) {
        console.log(JSON.stringify(allEntries.map(e => ({
          provider: e.providerId,
          name: e.name,
          config: e.config,
        })), null, 2));
        return;
      }

      if (allEntries.length === 0) {
        console.log(pc.dim("No MCP servers configured."));
        return;
      }

      console.log(pc.bold(`\n${allEntries.length} MCP server(s) configured:\n`));

      for (const entry of allEntries) {
        console.log(`  ${pc.bold(entry.name.padEnd(25))} ${pc.dim(entry.providerId)}`);
      }

      console.log();
    });
}
