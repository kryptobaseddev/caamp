/**
 * mcp detect command - auto-detect installed MCP tools
 */

import type { Command } from "commander";
import pc from "picocolors";
import { existsSync } from "node:fs";
import { getInstalledProviders } from "../../core/registry/detection.js";
import { resolveConfigPath, listMcpServers } from "../../core/mcp/reader.js";

export function registerMcpDetect(parent: Command): void {
  parent
    .command("detect")
    .description("Auto-detect installed MCP tools and their configurations")
    .option("--json", "Output as JSON")
    .action(async (opts: { json?: boolean }) => {
      const providers = getInstalledProviders();

      const detected: Array<{
        provider: string;
        hasGlobalConfig: boolean;
        hasProjectConfig: boolean;
        globalServers: string[];
        projectServers: string[];
      }> = [];

      for (const provider of providers) {
        const globalPath = resolveConfigPath(provider, "global");
        const projectPath = resolveConfigPath(provider, "project");

        const globalEntries = await listMcpServers(provider, "global");
        const projectEntries = await listMcpServers(provider, "project");

        detected.push({
          provider: provider.id,
          hasGlobalConfig: globalPath !== null && existsSync(globalPath),
          hasProjectConfig: projectPath !== null && existsSync(projectPath),
          globalServers: globalEntries.map(e => e.name),
          projectServers: projectEntries.map(e => e.name),
        });
      }

      if (opts.json) {
        console.log(JSON.stringify(detected, null, 2));
        return;
      }

      console.log(pc.bold(`\n${detected.length} provider(s) with MCP support:\n`));

      for (const d of detected) {
        const globalIcon = d.hasGlobalConfig ? pc.green("G") : pc.dim("-");
        const projectIcon = d.hasProjectConfig ? pc.green("P") : pc.dim("-");
        const servers = [...d.globalServers, ...d.projectServers];
        const serverList = servers.length > 0 ? pc.dim(servers.join(", ")) : pc.dim("no servers");

        console.log(`  [${globalIcon}${projectIcon}] ${pc.bold(d.provider.padEnd(20))} ${serverList}`);
      }

      console.log(pc.dim("\nG = global config, P = project config"));
      console.log();
    });
}
