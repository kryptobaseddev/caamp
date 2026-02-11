/**
 * Skills lock file management
 *
 * Shares the same lock file as MCP (~/.agents/.caamp-lock.json).
 */

import type { CaampLockFile, LockEntry, SourceType } from "../../types.js";
import { readLockFile } from "../mcp/lock.js";
import { writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const LOCK_DIR = join(homedir(), ".agents");
const LOCK_FILE = join(LOCK_DIR, ".caamp-lock.json");

async function writeLockFile(lock: CaampLockFile): Promise<void> {
  await mkdir(LOCK_DIR, { recursive: true });
  await writeFile(LOCK_FILE, JSON.stringify(lock, null, 2) + "\n", "utf-8");
}

/** Record a skill installation */
export async function recordSkillInstall(
  skillName: string,
  scopedName: string,
  source: string,
  sourceType: SourceType,
  agents: string[],
  canonicalPath: string,
  isGlobal: boolean,
  projectDir?: string,
  version?: string,
): Promise<void> {
  const lock = await readLockFile();
  const now = new Date().toISOString();

  const existing = lock.skills[skillName];

  lock.skills[skillName] = {
    name: skillName,
    scopedName,
    source,
    sourceType,
    version,
    installedAt: existing?.installedAt ?? now,
    updatedAt: now,
    agents: [...new Set([...(existing?.agents ?? []), ...agents])],
    canonicalPath,
    isGlobal,
    projectDir,
  };

  await writeLockFile(lock);
}

/** Remove a skill from the lock file */
export async function removeSkillFromLock(skillName: string): Promise<boolean> {
  const lock = await readLockFile();
  if (!(skillName in lock.skills)) return false;

  delete lock.skills[skillName];
  await writeLockFile(lock);
  return true;
}

/** Get all tracked skills */
export async function getTrackedSkills(): Promise<Record<string, LockEntry>> {
  const lock = await readLockFile();
  return lock.skills;
}

/** Check if a skill has updates available (comparing version/hash) */
export async function checkSkillUpdate(skillName: string): Promise<{
  hasUpdate: boolean;
  currentVersion?: string;
  latestVersion?: string;
}> {
  const lock = await readLockFile();
  const entry = lock.skills[skillName];
  if (!entry) {
    return { hasUpdate: false };
  }

  // For git-based sources, we'd need to check remote HEAD
  // For now, return no update (actual check requires network)
  return {
    hasUpdate: false,
    currentVersion: entry.version,
  };
}
