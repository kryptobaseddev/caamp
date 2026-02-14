/**
 * Shared lock file utilities
 *
 * Single source of truth for reading/writing the canonical CAAMP lock file path.
 * Both MCP and skills lock modules import from here.
 */

import { open, readFile, writeFile, mkdir, rm, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { CaampLockFile } from "../types.js";
import { AGENTS_HOME, LOCK_FILE_PATH } from "./paths/agents.js";

const LOCK_GUARD_PATH = `${LOCK_FILE_PATH}.lock`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireLockGuard(retries = 40, delayMs = 25): Promise<void> {
  await mkdir(AGENTS_HOME, { recursive: true });

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const handle = await open(LOCK_GUARD_PATH, "wx");
      await handle.close();
      return;
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || (error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
      await sleep(delayMs);
    }
  }

  throw new Error("Timed out waiting for lock file guard");
}

async function releaseLockGuard(): Promise<void> {
  await rm(LOCK_GUARD_PATH, { force: true });
}

async function writeLockFileUnsafe(lock: CaampLockFile): Promise<void> {
  const tmpPath = `${LOCK_FILE_PATH}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmpPath, JSON.stringify(lock, null, 2) + "\n", "utf-8");
  await rename(tmpPath, LOCK_FILE_PATH);
}

/** Read the lock file */
export async function readLockFile(): Promise<CaampLockFile> {
  try {
    if (!existsSync(LOCK_FILE_PATH)) {
      return { version: 1, skills: {}, mcpServers: {} };
    }
    const content = await readFile(LOCK_FILE_PATH, "utf-8");
    return JSON.parse(content) as CaampLockFile;
  } catch {
    return { version: 1, skills: {}, mcpServers: {} };
  }
}

/** Write the lock file */
export async function writeLockFile(lock: CaampLockFile): Promise<void> {
  await acquireLockGuard();
  try {
    await writeLockFileUnsafe(lock);
  } finally {
    await releaseLockGuard();
  }
}

/** Safely read-modify-write the lock file under a process lock guard. */
export async function updateLockFile(
  updater: (lock: CaampLockFile) => void | Promise<void>,
): Promise<CaampLockFile> {
  await acquireLockGuard();
  try {
    const lock = await readLockFile();
    await updater(lock);
    await writeLockFileUnsafe(lock);
    return lock;
  } finally {
    await releaseLockGuard();
  }
}
