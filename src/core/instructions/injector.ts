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

/** Check if a file has a CAAMP injection block */
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

/** Inject content into a file */
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

/** Remove the CAAMP injection block from a file */
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

/** Check injection status across all providers' instruction files */
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

/** Inject content into all providers' instruction files */
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
