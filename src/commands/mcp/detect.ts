/**
 * mcp detect command - auto-detect installed MCP tools
 */

import { Command } from "commander";
import pc from "picocolors";
import { getInstalledProviders } from "../../core/registry/detection.js";
import { readConfig } from "../../core/formats/index.js";
import { getNestedValue } from "../../core/formats/utils.js";
import { existsSync } from "node:fs";
import { join } from "node:path";

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
        const entry = {
          provider: provider.id,
          hasGlobalConfig: false,
          hasProjectConfig: false,
          globalServers: [] as string[],
          projectServers: [] as string[],
        };

        // Check global config
        if (existsSync(provider.configPathGlobal)) {
          entry.hasGlobalConfig = true;
          try {
            const config = await readConfig(provider.configPathGlobal, provider.configFormat);
            const servers = getNestedValue(config, provider.configKey);
            if (servers && typeof servers === "object") {
              entry.globalServers = Object.keys(servers as Record<string, unknown>);
            }
          } catch {
            // Ignore read errors
          }
        }

        // Check project config
        if (provider.configPathProject) {
          const projectPath = join(process.cwd(), provider.configPathProject);
          if (existsSync(projectPath)) {
            entry.hasProjectConfig = true;
            try {
              const config = await readConfig(projectPath, provider.configFormat);
              const servers = getNestedValue(config, provider.configKey);
              if (servers && typeof servers === "object") {
                entry.projectServers = Object.keys(servers as Record<string, unknown>);
              }
            } catch {
              // Ignore read errors
            }
          }
        }

        detected.push(entry);
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
