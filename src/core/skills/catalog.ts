/**
 * ESM adapter for @cleocode/ct-skills (CommonJS module)
 *
 * Wraps the ct-skills library API with typed exports for use in CAAMP's
 * ESM codebase. Uses createRequire() for CJS interop.
 */

import { createRequire } from "node:module";
import type {
  CtSkillEntry,
  CtProfileDefinition,
  CtValidationResult,
  CtDispatchMatrix,
  CtManifest,
} from "../../types.js";

const require = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _ctSkills: any;

function getCtSkills() {
  if (!_ctSkills) {
    try {
      _ctSkills = require("@cleocode/ct-skills");
    } catch {
      throw new Error(
        "@cleocode/ct-skills is not installed. Run: npm install @cleocode/ct-skills",
      );
    }
  }
  return _ctSkills;
}

// ── Core data ────────────────────────────────────────────────────────

/** All skill entries from skills.json */
export function getSkills(): CtSkillEntry[] {
  return getCtSkills().skills;
}

/** Parsed manifest.json dispatch registry */
export function getManifest(): CtManifest {
  return getCtSkills().manifest;
}

// ── Skill lookup ─────────────────────────────────────────────────────

/** List all skill names */
export function listSkills(): string[] {
  return getCtSkills().listSkills();
}

/** Get skill metadata from skills.json by name */
export function getSkill(name: string): CtSkillEntry | undefined {
  return getCtSkills().getSkill(name);
}

/** Resolve absolute path to a skill's SKILL.md file */
export function getSkillPath(name: string): string {
  return getCtSkills().getSkillPath(name);
}

/** Resolve absolute path to a skill's directory */
export function getSkillDir(name: string): string {
  return getCtSkills().getSkillDir(name);
}

/** Read a skill's SKILL.md content as a string */
export function readSkillContent(name: string): string {
  return getCtSkills().readSkillContent(name);
}

// ── Core & Dependency awareness ──────────────────────────────────────

/** Get all skills where core === true */
export function getCoreSkills(): CtSkillEntry[] {
  return getCtSkills().getCoreSkills();
}

/** Get skills filtered by category */
export function getSkillsByCategory(category: CtSkillEntry["category"]): CtSkillEntry[] {
  return getCtSkills().getSkillsByCategory(category);
}

/** Get direct dependency names for a skill */
export function getSkillDependencies(name: string): string[] {
  return getCtSkills().getSkillDependencies(name);
}

/** Resolve full dependency tree for a set of skill names (includes transitive deps) */
export function resolveDependencyTree(names: string[]): string[] {
  return getCtSkills().resolveDependencyTree(names);
}

// ── Profile-based selection ──────────────────────────────────────────

/** List available profile names */
export function listProfiles(): string[] {
  return getCtSkills().listProfiles();
}

/** Get a profile definition by name */
export function getProfile(name: string): CtProfileDefinition | undefined {
  return getCtSkills().getProfile(name);
}

/** Resolve a profile to its full skill list (follows extends, resolves deps) */
export function resolveProfile(name: string): string[] {
  return getCtSkills().resolveProfile(name);
}

// ── Shared resources ─────────────────────────────────────────────────

/** List available shared resource names */
export function listSharedResources(): string[] {
  return getCtSkills().listSharedResources();
}

/** Get absolute path to a shared resource file */
export function getSharedResourcePath(name: string): string | undefined {
  return getCtSkills().getSharedResourcePath(name);
}

/** Read a shared resource file content */
export function readSharedResource(name: string): string | undefined {
  return getCtSkills().readSharedResource(name);
}

// ── Protocols ────────────────────────────────────────────────────────

/** List available protocol names */
export function listProtocols(): string[] {
  return getCtSkills().listProtocols();
}

/** Get absolute path to a protocol file */
export function getProtocolPath(name: string): string | undefined {
  return getCtSkills().getProtocolPath(name);
}

/** Read a protocol file content */
export function readProtocol(name: string): string | undefined {
  return getCtSkills().readProtocol(name);
}

// ── Validation ───────────────────────────────────────────────────────

/** Validate a single skill's frontmatter */
export function validateSkillFrontmatter(name: string): CtValidationResult {
  return getCtSkills().validateSkillFrontmatter(name);
}

/** Validate all skills */
export function validateAll(): Map<string, CtValidationResult> {
  return getCtSkills().validateAll();
}

// ── Dispatch ─────────────────────────────────────────────────────────

/** Get the dispatch matrix from manifest.json */
export function getDispatchMatrix(): CtDispatchMatrix {
  return getCtSkills().getDispatchMatrix();
}

// ── Package metadata ─────────────────────────────────────────────────

/** Package version from ct-skills package.json */
export function getVersion(): string {
  return getCtSkills().version;
}

/** Absolute path to the ct-skills package root directory */
export function getLibraryRoot(): string {
  return getCtSkills().libraryRoot;
}

/**
 * Check if @cleocode/ct-skills is available.
 * Returns false if the package is not installed.
 */
export function isCatalogAvailable(): boolean {
  try {
    getCtSkills();
    return true;
  } catch {
    return false;
  }
}
