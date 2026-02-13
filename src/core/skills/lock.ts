/**
 * Skills lock file management
 *
 * Shares the same canonical lock file as MCP.
 */

import type { LockEntry, SourceType } from "../../types.js";
import { readLockFile, updateLockFile } from "../lock-utils.js";
import { parseSource } from "../sources/parser.js";
import { simpleGit } from "simple-git";

/**
 * Record a skill installation in the lock file.
 *
 * Creates or updates an entry in `lock.skills`. If the skill already exists,
 * the agent list is merged and `updatedAt` is refreshed while `installedAt` is preserved.
 *
 * @param skillName - Skill name
 * @param scopedName - Scoped name (may include marketplace scope)
 * @param source - Original source string
 * @param sourceType - Classified source type
 * @param agents - Provider IDs the skill was linked to
 * @param canonicalPath - Absolute path to the canonical installation
 * @param isGlobal - Whether this is a global installation
 * @param projectDir - Project directory (for project-scoped installs)
 * @param version - Version string or commit SHA
 *
 * @example
 * ```typescript
 * import { getCanonicalSkillsDir } from "../paths/standard.js";
 * import { join } from "node:path";
 *
 * await recordSkillInstall(
 *   "my-skill", "my-skill", "owner/repo", "github",
 *   ["claude-code"], join(getCanonicalSkillsDir(), "my-skill"), true,
 * );
 * ```
 */
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
  await updateLockFile((lock) => {
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
  });
}

/**
 * Remove a skill entry from the lock file.
 *
 * @param skillName - Name of the skill to remove
 * @returns `true` if the entry was found and removed, `false` if not found
 *
 * @example
 * ```typescript
 * const removed = await removeSkillFromLock("my-skill");
 * ```
 */
export async function removeSkillFromLock(skillName: string): Promise<boolean> {
  let removed = false;
  await updateLockFile((lock) => {
    if (!(skillName in lock.skills)) return;
    delete lock.skills[skillName];
    removed = true;
  });
  return removed;
}

/**
 * Get all skills tracked in the lock file.
 *
 * @returns Record of skill name to lock entry
 *
 * @example
 * ```typescript
 * const skills = await getTrackedSkills();
 * for (const [name, entry] of Object.entries(skills)) {
 *   console.log(`${name}: ${entry.source}`);
 * }
 * ```
 */
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

/**
 * Check if a skill has updates available by comparing the installed version
 * against the latest remote commit SHA.
 *
 * Only supports GitHub and GitLab sources. Returns `"unknown"` for local,
 * package, or other source types.
 *
 * @param skillName - Name of the installed skill to check
 * @returns Object with update status, current version, and latest version
 *
 * @example
 * ```typescript
 * const update = await checkSkillUpdate("my-skill");
 * if (update.hasUpdate) {
 *   console.log(`Update available: ${update.currentVersion} -> ${update.latestVersion}`);
 * }
 * ```
 */
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
