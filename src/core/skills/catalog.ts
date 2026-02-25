/**
 * Skill catalog - registry pattern for pluggable skill libraries.
 *
 * Projects MUST register their skill library via registerSkillLibrary() or
 * registerSkillLibraryFromPath(). CAAMP no longer auto-discovers from
 * ~/.agents/skill-library/ - explicit registration is required.
 *
 * All public functions delegate to the registered SkillLibrary instance.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { buildLibraryFromFiles, loadLibraryFromModule } from "./library-loader.js";
import type {
  SkillLibrary,
  SkillLibraryEntry,
  SkillLibraryManifest,
  SkillLibraryProfile,
  SkillLibraryDispatchMatrix,
  SkillLibraryValidationResult,
} from "./skill-library.js";

// ── Registry ────────────────────────────────────────────────────────

let _library: SkillLibrary | null = null;

/**
 * Register a SkillLibrary instance directly.
 *
 * @param library - A SkillLibrary implementation to use as the catalog
 */
export function registerSkillLibrary(library: SkillLibrary): void {
  _library = library;
}

/**
 * Register a skill library by loading it from a directory path.
 *
 * Tries two strategies:
 * 1. If the directory has an `index.js`, loads it as a module
 * 2. Otherwise, builds a library from raw files (skills.json, etc.)
 *
 * @param root - Absolute path to the skill library root directory
 * @throws If the library cannot be loaded from the given path
 */
export function registerSkillLibraryFromPath(root: string): void {
  // Try module-based loading first (has index.js)
  const indexPath = join(root, "index.js");
  if (existsSync(indexPath)) {
    _library = loadLibraryFromModule(root);
    return;
  }

  // Fall back to file-based loading (has skills.json)
  _library = buildLibraryFromFiles(root);
}

/**
 * Clear the registered library. Primarily for testing.
 */
export function clearRegisteredLibrary(): void {
  _library = null;
}

// ── Auto-discovery ──────────────────────────────────────────────────

/**
 * Attempt to discover a skill library from well-known locations.
 *
 * Discovery order:
 * 1. CAAMP_SKILL_LIBRARY env var (path to library root)
 */
function discoverLibrary(): SkillLibrary | null {
  // 1. Environment variable
  const envPath = process.env["CAAMP_SKILL_LIBRARY"];
  if (envPath && existsSync(envPath)) {
    try {
      const indexPath = join(envPath, "index.js");
      if (existsSync(indexPath)) {
        return loadLibraryFromModule(envPath);
      }
      if (existsSync(join(envPath, "skills.json"))) {
        return buildLibraryFromFiles(envPath);
      }
    } catch {
      // Fall through
    }
  }

  return null;
}

// ── Internal accessor ───────────────────────────────────────────────

function getLibrary(): SkillLibrary {
  if (!_library) {
    const discovered = discoverLibrary();
    if (discovered) {
      _library = discovered;
    }
  }

  if (!_library) {
    throw new Error(
      "No skill library registered. Register one with registerSkillLibraryFromPath() " +
      "or set the CAAMP_SKILL_LIBRARY environment variable.",
    );
  }

  return _library;
}

// ── Public API (delegates to registered library) ────────────────────

/**
 * Check if a skill library is available (registered or discoverable).
 * Returns false if no library is registered and auto-discovery fails.
 */
export function isCatalogAvailable(): boolean {
  try {
    getLibrary();
    return true;
  } catch {
    return false;
  }
}

/** All skill entries from the catalog. */
export function getSkills(): SkillLibraryEntry[] {
  return getLibrary().skills;
}

/** The parsed manifest. */
export function getManifest(): SkillLibraryManifest {
  return getLibrary().manifest;
}

/** List all skill names. */
export function listSkills(): string[] {
  return getLibrary().listSkills();
}

/** Get skill metadata by name. */
export function getSkill(name: string): SkillLibraryEntry | undefined {
  return getLibrary().getSkill(name);
}

/** Resolve absolute path to a skill's SKILL.md file. */
export function getSkillPath(name: string): string {
  return getLibrary().getSkillPath(name);
}

/** Resolve absolute path to a skill's directory. */
export function getSkillDir(name: string): string {
  return getLibrary().getSkillDir(name);
}

/** Read a skill's SKILL.md content as a string. */
export function readSkillContent(name: string): string {
  return getLibrary().readSkillContent(name);
}

/** Get all skills where `core === true`. */
export function getCoreSkills(): SkillLibraryEntry[] {
  return getLibrary().getCoreSkills();
}

/** Get skills filtered by category. */
export function getSkillsByCategory(category: SkillLibraryEntry["category"]): SkillLibraryEntry[] {
  return getLibrary().getSkillsByCategory(category);
}

/** Get direct dependency names for a skill. */
export function getSkillDependencies(name: string): string[] {
  return getLibrary().getSkillDependencies(name);
}

/** Resolve full dependency tree for a set of skill names (includes transitive deps). */
export function resolveDependencyTree(names: string[]): string[] {
  return getLibrary().resolveDependencyTree(names);
}

/** List available profile names. */
export function listProfiles(): string[] {
  return getLibrary().listProfiles();
}

/** Get a profile definition by name. */
export function getProfile(name: string): SkillLibraryProfile | undefined {
  return getLibrary().getProfile(name);
}

/** Resolve a profile to its full skill list (follows extends, resolves deps). */
export function resolveProfile(name: string): string[] {
  return getLibrary().resolveProfile(name);
}

/** List available shared resource names. */
export function listSharedResources(): string[] {
  return getLibrary().listSharedResources();
}

/** Get absolute path to a shared resource file. */
export function getSharedResourcePath(name: string): string | undefined {
  return getLibrary().getSharedResourcePath(name);
}

/** Read a shared resource file content. */
export function readSharedResource(name: string): string | undefined {
  return getLibrary().readSharedResource(name);
}

/** List available protocol names. */
export function listProtocols(): string[] {
  return getLibrary().listProtocols();
}

/** Get absolute path to a protocol file. */
export function getProtocolPath(name: string): string | undefined {
  return getLibrary().getProtocolPath(name);
}

/** Read a protocol file content. */
export function readProtocol(name: string): string | undefined {
  return getLibrary().readProtocol(name);
}

/** Validate a single skill's frontmatter. */
export function validateSkillFrontmatter(name: string): SkillLibraryValidationResult {
  return getLibrary().validateSkillFrontmatter(name);
}

/** Validate all skills. */
export function validateAll(): Map<string, SkillLibraryValidationResult> {
  return getLibrary().validateAll();
}

/** Get the dispatch matrix from the manifest. */
export function getDispatchMatrix(): SkillLibraryDispatchMatrix {
  return getLibrary().getDispatchMatrix();
}

/** Library version string. */
export function getVersion(): string {
  return getLibrary().version;
}

/** Absolute path to the library root directory. */
export function getLibraryRoot(): string {
  return getLibrary().libraryRoot;
}
