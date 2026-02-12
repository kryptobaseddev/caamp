/**
 * Marker-based instruction file injection
 *
 * Injects content blocks between CAAMP markers in instruction files
 * (CLAUDE.md, AGENTS.md, GEMINI.md).
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import type { InjectionStatus, InjectionCheckResult, Provider } from "../../types.js";

const MARKER_START = "<!-- CAAMP:START -->";
const MARKER_END = "<!-- CAAMP:END -->";
const MARKER_PATTERN = /<!-- CAAMP:START -->[\s\S]*?<!-- CAAMP:END -->/;

/**
 * Check the status of a CAAMP injection block in an instruction file.
 *
 * Returns the injection status:
 * - `"missing"` - File does not exist
 * - `"none"` - File exists but has no CAAMP markers
 * - `"current"` - CAAMP block exists and matches expected content (or no expected content given)
 * - `"outdated"` - CAAMP block exists but differs from expected content
 *
 * @param filePath - Absolute path to the instruction file
 * @param expectedContent - Optional expected content to compare against
 * @returns The injection status
 *
 * @example
 * ```typescript
 * const status = await checkInjection("/project/CLAUDE.md", expectedContent);
 * if (status === "outdated") {
 *   console.log("CAAMP injection needs updating");
 * }
 * ```
 */
export async function checkInjection(
  filePath: string,
  expectedContent?: string,
): Promise<InjectionStatus> {
  if (!existsSync(filePath)) return "missing";

  const content = await readFile(filePath, "utf-8");

  if (!MARKER_PATTERN.test(content)) return "none";

  if (expectedContent) {
    const blockContent = extractBlock(content);
    if (blockContent && blockContent.trim() === expectedContent.trim()) {
      return "current";
    }
    return "outdated";
  }

  return "current";
}

/** Extract the content between CAAMP markers */
function extractBlock(content: string): string | null {
  const match = content.match(MARKER_PATTERN);
  if (!match) return null;

  return match[0]
    .replace(MARKER_START, "")
    .replace(MARKER_END, "")
    .trim();
}

/** Build the injection block */
function buildBlock(content: string): string {
  return `${MARKER_START}\n${content}\n${MARKER_END}`;
}

/**
 * Inject content into an instruction file between CAAMP markers.
 *
 * Behavior depends on the file state:
 * - File does not exist: creates the file with the injection block
 * - File exists without markers: prepends the injection block
 * - File exists with markers: replaces the existing injection block
 *
 * @param filePath - Absolute path to the instruction file
 * @param content - Content to inject between CAAMP markers
 * @returns Action taken: `"created"`, `"added"`, or `"updated"`
 *
 * @example
 * ```typescript
 * const action = await inject("/project/CLAUDE.md", "## My Config\nSome content");
 * console.log(`File ${action}`);
 * ```
 */
export async function inject(
  filePath: string,
  content: string,
): Promise<"created" | "added" | "updated"> {
  const block = buildBlock(content);

  // Ensure parent directory exists
  await mkdir(dirname(filePath), { recursive: true });

  if (!existsSync(filePath)) {
    // Create new file with injection block
    await writeFile(filePath, block + "\n", "utf-8");
    return "created";
  }

  const existing = await readFile(filePath, "utf-8");

  if (MARKER_PATTERN.test(existing)) {
    // Replace existing block
    const updated = existing.replace(MARKER_PATTERN, block);
    await writeFile(filePath, updated, "utf-8");
    return "updated";
  }

  // Prepend block to existing content
  const updated = block + "\n\n" + existing;
  await writeFile(filePath, updated, "utf-8");
  return "added";
}

/**
 * Remove the CAAMP injection block from an instruction file.
 *
 * If removing the block would leave the file empty, the file is deleted entirely.
 *
 * @param filePath - Absolute path to the instruction file
 * @returns `true` if a CAAMP block was found and removed, `false` otherwise
 *
 * @example
 * ```typescript
 * const removed = await removeInjection("/project/CLAUDE.md");
 * ```
 */
export async function removeInjection(filePath: string): Promise<boolean> {
  if (!existsSync(filePath)) return false;

  const content = await readFile(filePath, "utf-8");
  if (!MARKER_PATTERN.test(content)) return false;

  const cleaned = content
    .replace(MARKER_PATTERN, "")
    .replace(/^\n{2,}/, "\n")
    .trim();

  if (!cleaned) {
    // File would be empty - remove it entirely
    const { rm } = await import("node:fs/promises");
    await rm(filePath);
  } else {
    await writeFile(filePath, cleaned + "\n", "utf-8");
  }

  return true;
}

/**
 * Check injection status across all providers' instruction files.
 *
 * Deduplicates by file path since multiple providers may share the same
 * instruction file (e.g. many providers use `AGENTS.md`).
 *
 * @param providers - Array of providers to check
 * @param projectDir - Absolute path to the project directory
 * @param scope - Whether to check project or global instruction files
 * @param expectedContent - Optional expected content to compare against
 * @returns Array of injection check results, one per unique instruction file
 *
 * @example
 * ```typescript
 * const results = await checkAllInjections(providers, "/project", "project");
 * const outdated = results.filter(r => r.status === "outdated");
 * ```
 */
export async function checkAllInjections(
  providers: Provider[],
  projectDir: string,
  scope: "project" | "global",
  expectedContent?: string,
): Promise<InjectionCheckResult[]> {
  const results: InjectionCheckResult[] = [];
  const checked = new Set<string>();

  for (const provider of providers) {
    const filePath = scope === "global"
      ? join(provider.pathGlobal, provider.instructFile)
      : join(projectDir, provider.instructFile);

    // Skip duplicates (multiple providers share same instruction file)
    if (checked.has(filePath)) continue;
    checked.add(filePath);

    const status = await checkInjection(filePath, expectedContent);

    results.push({
      file: filePath,
      provider: provider.id,
      status,
      fileExists: existsSync(filePath),
    });
  }

  return results;
}

/**
 * Inject content into all providers' instruction files.
 *
 * Deduplicates by file path to avoid injecting the same file multiple times.
 *
 * @param providers - Array of providers to inject into
 * @param projectDir - Absolute path to the project directory
 * @param scope - Whether to target project or global instruction files
 * @param content - Content to inject between CAAMP markers
 * @returns Map of file path to action taken (`"created"`, `"added"`, or `"updated"`)
 *
 * @example
 * ```typescript
 * const results = await injectAll(providers, "/project", "project", content);
 * for (const [file, action] of results) {
 *   console.log(`${file}: ${action}`);
 * }
 * ```
 */
export async function injectAll(
  providers: Provider[],
  projectDir: string,
  scope: "project" | "global",
  content: string,
): Promise<Map<string, "created" | "added" | "updated">> {
  const results = new Map<string, "created" | "added" | "updated">();
  const injected = new Set<string>();

  for (const provider of providers) {
    const filePath = scope === "global"
      ? join(provider.pathGlobal, provider.instructFile)
      : join(projectDir, provider.instructFile);

    // Skip duplicates
    if (injected.has(filePath)) continue;
    injected.add(filePath);

    const action = await inject(filePath, content);
    results.set(filePath, action);
  }

  return results;
}
