/**
 * mcp list command
 */

import { Command } from "commander";
import pc from "picocolors";
import { getInstalledProviders } from "../../core/registry/detection.js";
import { getProvider } from "../../core/registry/providers.js";
import { readConfig } from "../../core/formats/index.js";
import { getNestedValue } from "../../core/formats/utils.js";
import { join } from "node:path";
import { existsSync } from "node:fs";

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

      const allServers: Record<string, Record<string, unknown>> = {};

      for (const provider of providers) {
        const configPath = opts.global
          ? provider.configPathGlobal
          : provider.configPathProject
            ? join(process.cwd(), provider.configPathProject)
            : provider.configPathGlobal;

        if (!existsSync(configPath)) continue;

        try {
          const config = await readConfig(configPath, provider.configFormat);
          const servers = getNestedValue(config, provider.configKey);

          if (servers && typeof servers === "object") {
            for (const [name, cfg] of Object.entries(servers as Record<string, unknown>)) {
              allServers[`${provider.id}:${name}`] = {
                provider: provider.id,
                name,
                config: cfg,
              };
            }
          }
        } catch {
          // Skip unreadable configs
        }
      }

      const entries = Object.values(allServers);

      if (opts.json) {
        console.log(JSON.stringify(entries, null, 2));
        return;
      }

      if (entries.length === 0) {
        console.log(pc.dim("No MCP servers configured."));
        return;
      }

      console.log(pc.bold(`\n${entries.length} MCP server(s) configured:\n`));

      for (const entry of entries) {
        const e = entry as { provider: string; name: string; config: unknown };
        console.log(`  ${pc.bold((e.name as string).padEnd(25))} ${pc.dim(e.provider as string)}`);
      }

      console.log();
    });
}
