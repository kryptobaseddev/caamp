/**
 * MCP lock file management
 *
 * Tracks installed MCP servers with source and agent metadata.
 * Stored at ~/.agents/.caamp-lock.json (shared with skills lock).
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import type { CaampLockFile, LockEntry, SourceType } from "../../types.js";

const LOCK_DIR = join(homedir(), ".agents");
const LOCK_FILE = join(LOCK_DIR, ".caamp-lock.json");

/** Read the lock file */
export async function readLockFile(): Promise<CaampLockFile> {
  try {
    if (!existsSync(LOCK_FILE)) {
      return { version: 1, skills: {}, mcpServers: {} };
    }
    const content = await readFile(LOCK_FILE, "utf-8");
    return JSON.parse(content) as CaampLockFile;
  } catch {
    return { version: 1, skills: {}, mcpServers: {} };
  }
}

/** Write the lock file */
async function writeLockFile(lock: CaampLockFile): Promise<void> {
  await mkdir(LOCK_DIR, { recursive: true });
  await writeFile(LOCK_FILE, JSON.stringify(lock, null, 2) + "\n", "utf-8");
}

/** Record an MCP server installation */
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

/** Remove an MCP server from the lock file */
export async function removeMcpFromLock(serverName: string): Promise<boolean> {
  const lock = await readLockFile();
  if (!(serverName in lock.mcpServers)) return false;

  delete lock.mcpServers[serverName];
  await writeLockFile(lock);
  return true;
}

/** Get all tracked MCP servers */
export async function getTrackedMcpServers(): Promise<Record<string, LockEntry>> {
  const lock = await readLockFile();
  return lock.mcpServers;
}

/** Save last selected agents for UX */
export async function saveLastSelectedAgents(agents: string[]): Promise<void> {
  const lock = await readLockFile();
  lock.lastSelectedAgents = agents;
  await writeLockFile(lock);
}

/** Get last selected agents */
export async function getLastSelectedAgents(): Promise<string[] | undefined> {
  const lock = await readLockFile();
  return lock.lastSelectedAgents;
}
