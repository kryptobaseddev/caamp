/**
 * MCP config reader
 *
 * Reads, lists, and removes MCP server entries from agent config files.
 * Provides the programmatic API that CLI commands delegate to.
 */

import { join } from "node:path";
import { existsSync } from "node:fs";
import type { Provider, McpServerEntry } from "../../types.js";
import { readConfig, removeConfig } from "../formats/index.js";
import { getNestedValue } from "../formats/utils.js";

/** Resolve the config file path for a provider and scope */
export function resolveConfigPath(
  provider: Provider,
  scope: "project" | "global",
  projectDir?: string,
): string | null {
  if (scope === "project") {
    if (!provider.configPathProject) return null;
    return join(projectDir ?? process.cwd(), provider.configPathProject);
  }
  return provider.configPathGlobal;
}

/** List MCP servers configured for a single provider */
export async function listMcpServers(
  provider: Provider,
  scope: "project" | "global",
  projectDir?: string,
): Promise<McpServerEntry[]> {
  const configPath = resolveConfigPath(provider, scope, projectDir);
  if (!configPath || !existsSync(configPath)) return [];

  try {
    const config = await readConfig(configPath, provider.configFormat);
    const servers = getNestedValue(config, provider.configKey);

    if (!servers || typeof servers !== "object") return [];

    const entries: McpServerEntry[] = [];
    for (const [name, cfg] of Object.entries(servers as Record<string, unknown>)) {
      entries.push({
        name,
        providerId: provider.id,
        providerName: provider.toolName,
        scope,
        configPath,
        config: (cfg ?? {}) as Record<string, unknown>,
      });
    }

    return entries;
  } catch {
    return [];
  }
}

/** List MCP servers across all given providers, deduplicating by config path */
export async function listAllMcpServers(
  providers: Provider[],
  scope: "project" | "global",
  projectDir?: string,
): Promise<McpServerEntry[]> {
  const seen = new Set<string>();
  const allEntries: McpServerEntry[] = [];

  for (const provider of providers) {
    const configPath = resolveConfigPath(provider, scope, projectDir);
    if (!configPath || seen.has(configPath)) continue;
    seen.add(configPath);

    const entries = await listMcpServers(provider, scope, projectDir);
    allEntries.push(...entries);
  }

  return allEntries;
}

/** Remove an MCP server entry from a provider's config file */
export async function removeMcpServer(
  provider: Provider,
  serverName: string,
  scope: "project" | "global",
  projectDir?: string,
): Promise<boolean> {
  const configPath = resolveConfigPath(provider, scope, projectDir);
  if (!configPath) return false;

  return removeConfig(configPath, provider.configFormat, provider.configKey, serverName);
}
