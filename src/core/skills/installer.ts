/**
 * Skill installer - canonical + symlink model
 *
 * Skills are stored once in a canonical location (.agents/skills/<name>/)
 * and symlinked to each target agent's skills directory.
 */

import { mkdir, symlink, rm, cp } from "node:fs/promises";
import { existsSync, lstatSync } from "node:fs";
import { join, } from "node:path";
import type { Provider, } from "../../types.js";
import { CANONICAL_SKILLS_DIR } from "../paths/agents.js";
import { resolveProviderSkillsDir } from "../paths/standard.js";

/**
 * Result of installing a skill to the canonical location and linking to agents.
 *
 * @example
 * ```typescript
 * const result = await installSkill(sourcePath, "my-skill", providers, true);
 * if (result.success) {
 *   console.log(`Installed to ${result.canonicalPath}`);
 *   console.log(`Linked to: ${result.linkedAgents.join(", ")}`);
 * }
 * ```
 */
export interface SkillInstallResult {
  /** Skill name. */
  name: string;
  /** Absolute path to the canonical installation directory. */
  canonicalPath: string;
  /** Provider IDs that were successfully linked. */
  linkedAgents: string[];
  /** Error messages from failed link operations. */
  errors: string[];
  /** Whether at least one agent was successfully linked. */
  success: boolean;
}

/** Ensure canonical skills directory exists */
async function ensureCanonicalDir(): Promise<void> {
  await mkdir(CANONICAL_SKILLS_DIR, { recursive: true });
}

/** Copy skill files to the canonical location */
export async function installToCanonical(
  sourcePath: string,
  skillName: string,
): Promise<string> {
  await ensureCanonicalDir();

  const targetDir = join(CANONICAL_SKILLS_DIR, skillName);

  // Remove existing if it exists
  if (existsSync(targetDir)) {
    await rm(targetDir, { recursive: true });
  }

  await cp(sourcePath, targetDir, { recursive: true });

  return targetDir;
}

/** Create a symlink from an agent's skills directory to the canonical location */
async function linkToAgent(
  canonicalPath: string,
  provider: Provider,
  skillName: string,
  isGlobal: boolean,
  projectDir?: string,
): Promise<{ success: boolean; error?: string }> {
  const targetSkillsDir = resolveProviderSkillsDir(
    provider,
    isGlobal ? "global" : "project",
    projectDir,
  );

  if (!targetSkillsDir) {
    return { success: false, error: `Provider ${provider.id} has no skills directory` };
  }

  try {
    await mkdir(targetSkillsDir, { recursive: true });

    const linkPath = join(targetSkillsDir, skillName);

    // Remove existing link/directory
    if (existsSync(linkPath)) {
      const stat = lstatSync(linkPath);
      if (stat.isSymbolicLink()) {
        await rm(linkPath);
      } else {
        await rm(linkPath, { recursive: true });
      }
    }

    // Create symlink (junction on Windows for compat)
    const symlinkType = process.platform === "win32" ? "junction" : "dir";
    try {
      await symlink(canonicalPath, linkPath, symlinkType);
    } catch {
      // Fallback to copy if symlinks not supported
      await cp(canonicalPath, linkPath, { recursive: true });
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Install a skill from a local path to the canonical location and link to agents.
 *
 * Copies the skill directory to the canonical skills directory and creates symlinks
 * (or copies on Windows) from each provider's skills directory to the canonical path.
 *
 * @param sourcePath - Local path to the skill directory to install
 * @param skillName - Name for the installed skill
 * @param providers - Target providers to link the skill to
 * @param isGlobal - Whether to link to global or project skill directories
 * @param projectDir - Project directory (defaults to `process.cwd()`)
 * @returns Install result with linked agents and any errors
 *
 * @example
 * ```typescript
 * const result = await installSkill("/tmp/my-skill", "my-skill", providers, true);
 * ```
 */
export async function installSkill(
  sourcePath: string,
  skillName: string,
  providers: Provider[],
  isGlobal: boolean,
  projectDir?: string,
): Promise<SkillInstallResult> {
  const errors: string[] = [];
  const linkedAgents: string[] = [];

  // Step 1: Install to canonical location
  const canonicalPath = await installToCanonical(sourcePath, skillName);

  // Step 2: Link to each agent
  for (const provider of providers) {
    const result = await linkToAgent(canonicalPath, provider, skillName, isGlobal, projectDir);
    if (result.success) {
      linkedAgents.push(provider.id);
    } else if (result.error) {
      errors.push(`${provider.id}: ${result.error}`);
    }
  }

  return {
    name: skillName,
    canonicalPath,
    linkedAgents,
    errors,
    success: linkedAgents.length > 0,
  };
}

/**
 * Remove a skill from the canonical location and all agent symlinks.
 *
 * Removes symlinks from each provider's skills directory and then removes the
 * canonical copy from the centralized canonical skills directory.
 *
 * @param skillName - Name of the skill to remove
 * @param providers - Providers to unlink the skill from
 * @param isGlobal - Whether to target global or project skill directories
 * @param projectDir - Project directory (defaults to `process.cwd()`)
 * @returns Object with arrays of successfully removed provider IDs and error messages
 *
 * @example
 * ```typescript
 * const { removed, errors } = await removeSkill("my-skill", providers, true);
 * ```
 */
export async function removeSkill(
  skillName: string,
  providers: Provider[],
  isGlobal: boolean,
  projectDir?: string,
): Promise<{ removed: string[]; errors: string[] }> {
  const removed: string[] = [];
  const errors: string[] = [];

  // Remove symlinks from each agent
  for (const provider of providers) {
    const skillsDir = resolveProviderSkillsDir(
      provider,
      isGlobal ? "global" : "project",
      projectDir,
    );

    if (!skillsDir) continue;

    const linkPath = join(skillsDir, skillName);
    if (existsSync(linkPath)) {
      try {
        await rm(linkPath, { recursive: true });
        removed.push(provider.id);
      } catch (err) {
        errors.push(`${provider.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // Remove canonical copy
  const canonicalPath = join(CANONICAL_SKILLS_DIR, skillName);
  if (existsSync(canonicalPath)) {
    try {
      await rm(canonicalPath, { recursive: true });
    } catch (err) {
      errors.push(`canonical: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { removed, errors };
}

/**
 * List all skills installed in the canonical skills directory.
 *
 * Returns the directory names of all skills, which correspond to skill names.
 *
 * @returns Array of skill names
 *
 * @example
 * ```typescript
 * const skills = await listCanonicalSkills();
 * // ["my-skill", "another-skill"]
 * ```
 */
export async function listCanonicalSkills(): Promise<string[]> {
  if (!existsSync(CANONICAL_SKILLS_DIR)) return [];

  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(CANONICAL_SKILLS_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() || e.isSymbolicLink())
    .map((e) => e.name);
}
