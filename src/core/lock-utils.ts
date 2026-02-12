/**
 * Shared lock file utilities
 *
 * Single source of truth for reading/writing ~/.agents/.caamp-lock.json.
 * Both MCP and skills lock modules import from here.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CaampLockFile } from "../types.js";

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
export async function writeLockFile(lock: CaampLockFile): Promise<void> {
  await mkdir(LOCK_DIR, { recursive: true });
  await writeFile(LOCK_FILE, JSON.stringify(lock, null, 2) + "\n", "utf-8");
}
