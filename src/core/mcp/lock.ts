/**
 * MCP lock file management
 *
 * Tracks installed MCP servers with source and agent metadata.
 * Stored at ~/.agents/.caamp-lock.json (shared with skills lock).
 */

import type { LockEntry, SourceType } from "../../types.js";
import { readLockFile, writeLockFile } from "../lock-utils.js";

/**
 * Read and parse the CAAMP lock file from `~/.agents/.caamp-lock.json`.
 *
 * Returns the full {@link CaampLockFile} structure. Creates a default lock file
 * if one does not exist.
 *
 * @returns The parsed lock file contents
 *
 * @example
 * ```typescript
 * const lock = await readLockFile();
 * console.log(Object.keys(lock.mcpServers));
 * ```
 */
export { readLockFile } from "../lock-utils.js";

/**
 * Record an MCP server installation in the lock file.
 *
 * Creates or updates an entry in `lock.mcpServers`. If the server already exists,
 * the agent list is merged and `updatedAt` is refreshed while `installedAt` is preserved.
 *
 * @param serverName - Name/key of the MCP server
 * @param source - Original source string
 * @param sourceType - Classified source type
 * @param agents - Provider IDs the server was installed to
 * @param isGlobal - Whether this is a global installation
 *
 * @example
 * ```typescript
 * await recordMcpInstall("filesystem", "@mcp/server-fs", "package", ["claude-code"], true);
 * ```
 */
export async function recordMcpInstall(
  serverName: string,
  source: string,
  sourceType: SourceType,
  agents: string[],
  isGlobal: boolean,
): Promise<void> {
  const lock = await readLockFile();
  const now = new Date().toISOString();

  const existing = lock.mcpServers[serverName];

  lock.mcpServers[serverName] = {
    name: serverName,
    scopedName: serverName,
    source,
    sourceType,
    installedAt: existing?.installedAt ?? now,
    updatedAt: now,
    agents: [...new Set([...(existing?.agents ?? []), ...agents])],
    canonicalPath: "",
    isGlobal,
  };

  await writeLockFile(lock);
}

/**
 * Remove an MCP server entry from the lock file.
 *
 * @param serverName - Name/key of the MCP server to remove
 * @returns `true` if the entry was found and removed, `false` if not found
 *
 * @example
 * ```typescript
 * const removed = await removeMcpFromLock("filesystem");
 * ```
 */
export async function removeMcpFromLock(serverName: string): Promise<boolean> {
  const lock = await readLockFile();
  if (!(serverName in lock.mcpServers)) return false;

  delete lock.mcpServers[serverName];
  await writeLockFile(lock);
  return true;
}

/**
 * Get all MCP servers tracked in the lock file.
 *
 * @returns Record of server name to lock entry
 *
 * @example
 * ```typescript
 * const servers = await getTrackedMcpServers();
 * for (const [name, entry] of Object.entries(servers)) {
 *   console.log(`${name}: installed ${entry.installedAt}`);
 * }
 * ```
 */
export async function getTrackedMcpServers(): Promise<Record<string, LockEntry>> {
  const lock = await readLockFile();
  return lock.mcpServers;
}

/**
 * Save the last selected agent IDs to the lock file for UX persistence.
 *
 * Used to remember the user's agent selection between CLI invocations.
 *
 * @param agents - Array of provider IDs to remember
 *
 * @example
 * ```typescript
 * await saveLastSelectedAgents(["claude-code", "cursor"]);
 * ```
 */
export async function saveLastSelectedAgents(agents: string[]): Promise<void> {
  const lock = await readLockFile();
  lock.lastSelectedAgents = agents;
  await writeLockFile(lock);
}

/**
 * Retrieve the last selected agent IDs from the lock file.
 *
 * @returns Array of provider IDs, or `undefined` if none were saved
 *
 * @example
 * ```typescript
 * const agents = await getLastSelectedAgents();
 * // ["claude-code", "cursor"] or undefined
 * ```
 */
export async function getLastSelectedAgents(): Promise<string[] | undefined> {
  const lock = await readLockFile();
  return lock.lastSelectedAgents;
}
