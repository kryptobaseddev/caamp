/**
 * Skills lock file management
 *
 * Shares the same lock file as MCP (~/.agents/.caamp-lock.json).
 */

import type { CaampLockFile, LockEntry, SourceType } from "../../types.js";
import { readLockFile } from "../mcp/lock.js";
import { parseSource } from "../sources/parser.js";
import { simpleGit } from "simple-git";
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

/** Fetch the latest commit SHA for a GitHub/GitLab repo via ls-remote */
async function fetchLatestSha(
  repoUrl: string,
  ref?: string,
): Promise<string | null> {
  try {
    const git = simpleGit();
    const target = ref ?? "HEAD";
    // Use --refs only for named refs (branches/tags), not for HEAD
    const args = target === "HEAD"
      ? [repoUrl, "HEAD"]
      : ["--refs", repoUrl, target];
    const result = await git.listRemote(args);
    const firstLine = result.trim().split("\n")[0];
    if (!firstLine) return null;
    const sha = firstLine.split("\t")[0];
    return sha ?? null;
  } catch {
    return null;
  }
}

/** Check if a skill has updates available (comparing version/hash) */
export async function checkSkillUpdate(skillName: string): Promise<{
  hasUpdate: boolean;
  currentVersion?: string;
  latestVersion?: string;
  status: "up-to-date" | "update-available" | "unknown";
}> {
  const lock = await readLockFile();
  const entry = lock.skills[skillName];
  if (!entry) {
    return { hasUpdate: false, status: "unknown" };
  }

  // Only GitHub and GitLab sources support remote checking
  if (entry.sourceType !== "github" && entry.sourceType !== "gitlab") {
    return {
      hasUpdate: false,
      currentVersion: entry.version,
      status: "unknown",
    };
  }

  const parsed = parseSource(entry.source);
  if (!parsed.owner || !parsed.repo) {
    return {
      hasUpdate: false,
      currentVersion: entry.version,
      status: "unknown",
    };
  }

  const host = parsed.type === "gitlab" ? "gitlab.com" : "github.com";
  const repoUrl = `https://${host}/${parsed.owner}/${parsed.repo}.git`;
  const latestSha = await fetchLatestSha(repoUrl, parsed.ref);

  if (!latestSha) {
    return {
      hasUpdate: false,
      currentVersion: entry.version,
      status: "unknown",
    };
  }

  const currentVersion = entry.version;
  const hasUpdate = !currentVersion || !latestSha.startsWith(currentVersion.slice(0, 7));

  return {
    hasUpdate,
    currentVersion: currentVersion ?? "unknown",
    latestVersion: latestSha.slice(0, 12),
    status: hasUpdate ? "update-available" : "up-to-date",
  };
}
