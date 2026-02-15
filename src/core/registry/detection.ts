/**
 * Provider auto-detection engine
 *
 * Detects which AI coding agents are installed on the system
 * by checking binaries, directories, app bundles, and flatpak.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Provider } from "../../types.js";
import { debug } from "../logger.js";
import { getPlatformLocations, resolveProviderProjectPath } from "../paths/standard.js";
import { getAllProviders } from "./providers.js";

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

export interface DetectionCacheOptions {
  forceRefresh?: boolean;
  ttlMs?: number;
}

interface DetectionCacheState {
  createdAt: number;
  signature: string;
  results: DetectionResult[];
}

const DEFAULT_DETECTION_CACHE_TTL_MS = 30_000;
let detectionCache: DetectionCacheState | null = null;

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
  const applications = getPlatformLocations().applications;
  return applications.some((base) => existsSync(join(base, appName)));
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

function providerSignature(provider: Provider): string {
  return JSON.stringify({
    id: provider.id,
    methods: provider.detection.methods,
    binary: provider.detection.binary,
    directories: provider.detection.directories,
    appBundle: provider.detection.appBundle,
    flatpakId: provider.detection.flatpakId,
  });
}

function buildProvidersSignature(providers: Provider[]): string {
  if (!providers || !Array.isArray(providers)) return "";
  return providers.map(providerSignature).join("|");
}

function cloneDetectionResults(results: DetectionResult[]): DetectionResult[] {
  return results.map((result) => ({
    provider: result.provider,
    installed: result.installed,
    methods: [...result.methods],
    projectDetected: result.projectDetected,
  }));
}

function getCachedResults(
  signature: string,
  options: DetectionCacheOptions,
): DetectionResult[] | null {
  if (!detectionCache || options.forceRefresh) return null;
  if (detectionCache.signature !== signature) return null;

  const ttlMs = options.ttlMs ?? DEFAULT_DETECTION_CACHE_TTL_MS;
  if (ttlMs <= 0) return null;
  if ((Date.now() - detectionCache.createdAt) > ttlMs) return null;

  return cloneDetectionResults(detectionCache.results);
}

function setCachedResults(signature: string, results: DetectionResult[]): void {
  detectionCache = {
    createdAt: Date.now(),
    signature,
    results: cloneDetectionResults(results),
  };
}

/** Detect if a provider has project-level config in the given directory */
export function detectProjectProvider(provider: Provider, projectDir: string): boolean {
  if (!provider.pathProject) return false;
  return existsSync(resolveProviderProjectPath(provider, projectDir));
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
export function detectAllProviders(options: DetectionCacheOptions = {}): DetectionResult[] {
  const providers = getAllProviders() ?? [];
  const signature = buildProvidersSignature(providers);
  const cached = getCachedResults(signature, options);
  if (cached) {
    debug(`detection cache hit for ${providers.length} providers`);
    return cached;
  }

  const results = providers.map(detectProvider);
  setCachedResults(signature, results);
  return cloneDetectionResults(results);
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
export function getInstalledProviders(options: DetectionCacheOptions = {}): Provider[] {
  return detectAllProviders(options)
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
export function detectProjectProviders(projectDir: string, options: DetectionCacheOptions = {}): DetectionResult[] {
  const results = detectAllProviders(options);
  return results.map((r) => ({
    ...r,
    projectDetected: detectProjectProvider(r.provider, projectDir),
  }));
}

export function resetDetectionCache(): void {
  detectionCache = null;
}
