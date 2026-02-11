/**
 * mcp install command
 */

import { Command } from "commander";
import pc from "picocolors";
import { parseSource } from "../../core/sources/parser.js";
import { installMcpServerToAll, buildServerConfig } from "../../core/mcp/installer.js";
import { recordMcpInstall } from "../../core/mcp/lock.js";
import { getInstalledProviders } from "../../core/registry/detection.js";
import { getProvider } from "../../core/registry/providers.js";
import type { Provider } from "../../types.js";

export function registerMcpInstall(parent: Command): void {
  parent
    .command("install")
    .description("Install MCP server to agent configs")
    .argument("<source>", "MCP server source (URL, npm package, or command)")
    .option("-a, --agent <name>", "Target specific agent(s)", (v, prev: string[]) => [...prev, v], [])
    .option("-g, --global", "Install to global/user config")
    .option("-n, --name <name>", "Override inferred server name")
    .option("-t, --transport <type>", "Transport type: http (default) or sse", "http")
    .option("--header <header>", "HTTP header (Key: Value)", (v, prev: string[]) => [...prev, v], [])
    .option("-y, --yes", "Skip confirmation")
    .option("--all", "Install to all detected agents")
    .option("--dry-run", "Preview without writing")
    .action(async (source: string, opts: {
      agent: string[];
      global?: boolean;
      name?: string;
      transport: string;
      header: string[];
      yes?: boolean;
      all?: boolean;
      dryRun?: boolean;
    }) => {
      const parsed = parseSource(source);
      const serverName = opts.name ?? parsed.inferredName;

      // Parse headers
      const headers: Record<string, string> = {};
      for (const h of opts.header) {
        const idx = h.indexOf(":");
        if (idx > 0) {
          headers[h.slice(0, idx).trim()] = h.slice(idx + 1).trim();
        }
      }

      const config = buildServerConfig(parsed, opts.transport, headers);

      // Determine target providers
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

      if (providers.length === 0) {
        console.error(pc.red("No target providers found."));
        process.exit(1);
      }

      const scope = opts.global ? "global" as const : "project" as const;

      if (opts.dryRun) {
        console.log(pc.bold("Dry run - would install:"));
        console.log(`  Server: ${pc.bold(serverName)}`);
        console.log(`  Config: ${JSON.stringify(config, null, 2)}`);
        console.log(`  Scope: ${scope}`);
        console.log(`  Providers: ${providers.map((p) => p.id).join(", ")}`);
        return;
      }

      console.log(pc.dim(`Installing "${serverName}" to ${providers.length} provider(s)...\n`));

      const results = await installMcpServerToAll(
        providers,
        serverName,
        config,
        scope,
      );

      for (const r of results) {
        if (r.success) {
          console.log(`  ${pc.green("✓")} ${r.provider.toolName.padEnd(22)} ${pc.dim(r.configPath)}`);
        } else {
          console.log(`  ${pc.red("✗")} ${r.provider.toolName.padEnd(22)} ${pc.red(r.error ?? "failed")}`);
        }
      }

      const succeeded = results.filter((r) => r.success);
      if (succeeded.length > 0) {
        await recordMcpInstall(
          serverName,
          source,
          parsed.type,
          succeeded.map((r) => r.provider.id),
          opts.global ?? false,
        );
      }

      console.log(pc.bold(`\n${succeeded.length}/${results.length} providers configured.`));
    });
}
