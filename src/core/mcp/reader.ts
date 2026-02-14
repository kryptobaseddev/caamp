/**
 * MCP config reader
 *
 * Reads, lists, and removes MCP server entries from agent config files.
 * Provides the programmatic API that CLI commands delegate to.
 */

import { existsSync } from "node:fs";
import type { Provider, McpServerEntry } from "../../types.js";
import { readConfig, removeConfig } from "../formats/index.js";
import { getNestedValue } from "../formats/utils.js";
import { debug } from "../logger.js";
import { resolveProviderConfigPath, getAgentsMcpServersPath } from "../paths/standard.js";

/**
 * Resolve the absolute config file path for a provider and scope.
 *
 * For project scope, joins the project directory with the provider's relative
 * config path. For global scope, returns the provider's global config path.
 *
 * @param provider - Provider to resolve config path for
 * @param scope - Whether to resolve project or global config path
 * @param projectDir - Project directory (defaults to `process.cwd()`)
 * @returns Absolute config file path, or `null` if the provider does not support the given scope
 *
 * @example
 * ```typescript
 * const path = resolveConfigPath(provider, "project", "/home/user/my-project");
 * // Returns provider-specific project config path
 * ```
 */
export function resolveConfigPath(
  provider: Provider,
  scope: "project" | "global",
  projectDir?: string,
): string | null {
  return resolveProviderConfigPath(provider, scope, projectDir ?? process.cwd());
}

/**
 * List MCP servers configured for a single provider.
 *
 * Reads the provider's config file, extracts the MCP servers section using the
 * provider's `configKey`, and returns each server entry with metadata.
 *
 * @param provider - Provider whose config file to read
 * @param scope - Whether to read project or global config
 * @param projectDir - Project directory (defaults to `process.cwd()`)
 * @returns Array of MCP server entries found in the config file
 *
 * @example
 * ```typescript
 * const servers = await listMcpServers(provider, "project");
 * for (const s of servers) {
 *   console.log(`${s.name} (${s.scope})`);
 * }
 * ```
 */
export async function listMcpServers(
  provider: Provider,
  scope: "project" | "global",
  projectDir?: string,
): Promise<McpServerEntry[]> {
  const configPath = resolveConfigPath(provider, scope, projectDir);
  debug(`listing MCP servers for ${provider.id} (${scope}) at ${configPath ?? "(none)"}`);
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

/**
 * List MCP servers from the `.agents/mcp/servers.json` standard location.
 *
 * Per the `.agents/` standard (Section 9), this file is the canonical
 * provider-agnostic MCP server registry. It should be checked before
 * per-provider legacy config files.
 *
 * @param scope - `"global"` for `~/.agents/mcp/servers.json`, `"project"` for project-level
 * @param projectDir - Project directory (defaults to `process.cwd()`)
 * @returns Array of MCP server entries found in the `.agents/` servers.json
 */
export async function listAgentsMcpServers(
  scope: "project" | "global",
  projectDir?: string,
): Promise<McpServerEntry[]> {
  const serversPath = getAgentsMcpServersPath(scope, projectDir);
  debug(`listing .agents/ MCP servers (${scope}) at ${serversPath}`);

  if (!existsSync(serversPath)) return [];

  try {
    const config = await readConfig(serversPath, "json");
    // .agents/mcp/servers.json uses { "servers": { "<name>": { ... } } }
    const servers = (config as Record<string, unknown>)["servers"];

    if (!servers || typeof servers !== "object") return [];

    const entries: McpServerEntry[] = [];
    for (const [name, cfg] of Object.entries(servers as Record<string, unknown>)) {
      entries.push({
        name,
        providerId: ".agents",
        providerName: ".agents/ standard",
        scope,
        configPath: serversPath,
        config: (cfg ?? {}) as Record<string, unknown>,
      });
    }

    return entries;
  } catch {
    return [];
  }
}

/**
 * List MCP servers across all given providers, deduplicating by config path.
 *
 * Per the `.agents/` standard (Section 9.4), checks `.agents/mcp/servers.json`
 * first, then falls back to per-provider legacy config files. Multiple providers
 * may share the same config file; this function ensures each config file is read
 * only once to avoid duplicate entries.
 *
 * @param providers - Array of providers to query
 * @param scope - Whether to read project or global config
 * @param projectDir - Project directory (defaults to `process.cwd()`)
 * @returns Combined array of MCP server entries from all providers
 *
 * @example
 * ```typescript
 * const allServers = await listAllMcpServers(getInstalledProviders(), "global");
 * ```
 */
export async function listAllMcpServers(
  providers: Provider[],
  scope: "project" | "global",
  projectDir?: string,
): Promise<McpServerEntry[]> {
  const seen = new Set<string>();
  const allEntries: McpServerEntry[] = [];

  // Check .agents/mcp/servers.json first (standard takes precedence)
  const agentsServersPath = getAgentsMcpServersPath(scope, projectDir);
  const agentsEntries = await listAgentsMcpServers(scope, projectDir);
  if (agentsEntries.length > 0) {
    allEntries.push(...agentsEntries);
    seen.add(agentsServersPath);
  }

  // Then check per-provider legacy config files
  for (const provider of providers) {
    const configPath = resolveConfigPath(provider, scope, projectDir);
    if (!configPath || seen.has(configPath)) continue;
    seen.add(configPath);

    const entries = await listMcpServers(provider, scope, projectDir);
    allEntries.push(...entries);
  }

  return allEntries;
}

/**
 * Remove an MCP server entry from a provider's config file.
 *
 * @param provider - Provider whose config file to modify
 * @param serverName - Name/key of the MCP server to remove
 * @param scope - Whether to modify project or global config
 * @param projectDir - Project directory (defaults to `process.cwd()`)
 * @returns `true` if the entry was removed, `false` if no config path exists
 *
 * @example
 * ```typescript
 * const removed = await removeMcpServer(provider, "my-server", "project");
 * ```
 */
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
