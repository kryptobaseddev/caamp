/**
 * Skill installer - canonical + symlink model
 *
 * Skills are stored once in a canonical location (.agents/skills/<name>/)
 * and symlinked to each target agent's skills directory.
 */

import { readFile, writeFile, mkdir, symlink, readlink, rm, cp } from "node:fs/promises";
import { existsSync, lstatSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, resolve } from "node:path";
import type { Provider, SkillMetadata, ParsedSource } from "../../types.js";
import { discoverSkill } from "./discovery.js";

const CANONICAL_DIR = join(homedir(), ".agents", "skills");

export interface SkillInstallResult {
  name: string;
  canonicalPath: string;
  linkedAgents: string[];
  errors: string[];
  success: boolean;
}

/** Ensure canonical skills directory exists */
async function ensureCanonicalDir(): Promise<void> {
  await mkdir(CANONICAL_DIR, { recursive: true });
}

/** Copy skill files to the canonical location */
export async function installToCanonical(
  sourcePath: string,
  skillName: string,
): Promise<string> {
  await ensureCanonicalDir();

  const targetDir = join(CANONICAL_DIR, skillName);

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
  const targetSkillsDir = isGlobal
    ? provider.pathSkills
    : join(projectDir ?? process.cwd(), provider.pathProjectSkills);

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

/** Install a skill from a local path to canonical + link to agents */
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

/** Remove a skill from canonical location and all agent symlinks */
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
    const skillsDir = isGlobal
      ? provider.pathSkills
      : join(projectDir ?? process.cwd(), provider.pathProjectSkills);

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
  const canonicalPath = join(CANONICAL_DIR, skillName);
  if (existsSync(canonicalPath)) {
    try {
      await rm(canonicalPath, { recursive: true });
    } catch (err) {
      errors.push(`canonical: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { removed, errors };
}

/** List all canonically installed skills */
export async function listCanonicalSkills(): Promise<string[]> {
  if (!existsSync(CANONICAL_DIR)) return [];

  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(CANONICAL_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() || e.isSymbolicLink())
    .map((e) => e.name);
}
