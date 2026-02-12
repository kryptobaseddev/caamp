/**
 * Provider auto-detection engine
 *
 * Detects which AI coding agents are installed on the system
 * by checking binaries, directories, app bundles, and flatpak.
 */

import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import type { Provider } from "../../types.js";
import { getAllProviders } from "./providers.js";
import { debug } from "../logger.js";

/**
 * Result of detecting whether a provider is installed on the system.
 *
 * @example
 * ```typescript
 * const result = detectProvider(provider);
 * if (result.installed) {
 *   console.log(`Found via: ${result.methods.join(", ")}`);
 * }
 * ```
 */
export interface DetectionResult {
  /** The provider that was checked. */
  provider: Provider;
  /** Whether the provider was detected as installed. */
  installed: boolean;
  /** Detection methods that matched (e.g. `["binary", "directory"]`). */
  methods: string[];
  /** Whether the provider has project-level config in the current directory. */
  projectDetected: boolean;
}

function checkBinary(binary: string): boolean {
  try {
    const cmd = process.platform === "win32" ? "where" : "which";
    execFileSync(cmd, [binary], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function checkDirectory(dir: string): boolean {
  return existsSync(dir);
}

function checkAppBundle(appName: string): boolean {
  if (process.platform !== "darwin") return false;
  return existsSync(join("/Applications", appName));
}

function checkFlatpak(flatpakId: string): boolean {
  if (process.platform !== "linux") return false;
  try {
    execFileSync("flatpak", ["info", flatpakId], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect if a single provider is installed on the system.
 *
 * Checks each detection method configured for the provider (binary, directory,
 * appBundle, flatpak) and returns which methods matched.
 *
 * @param provider - The provider to detect
 * @returns Detection result with installation status and matched methods
 *
 * @example
 * ```typescript
 * const provider = getProvider("claude-code")!;
 * const result = detectProvider(provider);
 * if (result.installed) {
 *   console.log(`Claude Code found via: ${result.methods.join(", ")}`);
 * }
 * ```
 */
export function detectProvider(provider: Provider): DetectionResult {
  const matchedMethods: string[] = [];
  const detection = provider.detection;

  debug(`detecting provider ${provider.id} via methods: ${detection.methods.join(", ")}`);

  for (const method of detection.methods) {
    switch (method) {
      case "binary":
        if (detection.binary && checkBinary(detection.binary)) {
          debug(`  ${provider.id}: binary "${detection.binary}" found`);
          matchedMethods.push("binary");
        }
        break;
      case "directory":
        if (detection.directories) {
          for (const dir of detection.directories) {
            if (checkDirectory(dir)) {
              matchedMethods.push("directory");
              break;
            }
          }
        }
        break;
      case "appBundle":
        if (detection.appBundle && checkAppBundle(detection.appBundle)) {
          matchedMethods.push("appBundle");
        }
        break;
      case "flatpak":
        if (detection.flatpakId && checkFlatpak(detection.flatpakId)) {
          matchedMethods.push("flatpak");
        }
        break;
    }
  }

  return {
    provider,
    installed: matchedMethods.length > 0,
    methods: matchedMethods,
    projectDetected: false,
  };
}

/** Detect if a provider has project-level config in the given directory */
export function detectProjectProvider(provider: Provider, projectDir: string): boolean {
  if (!provider.pathProject) return false;
  return existsSync(join(projectDir, provider.pathProject));
}

/**
 * Detect all registered providers and return their installation status.
 *
 * Runs detection for every provider in the registry.
 *
 * @returns Array of detection results for all providers
 *
 * @example
 * ```typescript
 * const results = detectAllProviders();
 * const installed = results.filter(r => r.installed);
 * console.log(`${installed.length} agents detected`);
 * ```
 */
export function detectAllProviders(): DetectionResult[] {
  const providers = getAllProviders();
  return providers.map(detectProvider);
}

/**
 * Get only providers that are currently installed on the system.
 *
 * Convenience wrapper that filters {@link detectAllProviders} results to only
 * those with `installed === true`.
 *
 * @returns Array of installed provider definitions
 *
 * @example
 * ```typescript
 * const installed = getInstalledProviders();
 * console.log(installed.map(p => p.toolName).join(", "));
 * ```
 */
export function getInstalledProviders(): Provider[] {
  return detectAllProviders()
    .filter((r) => r.installed)
    .map((r) => r.provider);
}

/**
 * Detect all providers and enrich results with project-level presence.
 *
 * Extends {@link detectAllProviders} by also checking whether each provider
 * has a project-level config file in the given directory.
 *
 * @param projectDir - Absolute path to the project directory to check
 * @returns Array of detection results with `projectDetected` populated
 *
 * @example
 * ```typescript
 * const results = detectProjectProviders("/home/user/my-project");
 * for (const r of results) {
 *   if (r.projectDetected) {
 *     console.log(`${r.provider.toolName} has project config`);
 *   }
 * }
 * ```
 */
export function detectProjectProviders(projectDir: string): DetectionResult[] {
  const results = detectAllProviders();
  return results.map((r) => ({
    ...r,
    projectDetected: detectProjectProvider(r.provider, projectDir),
  }));
}
