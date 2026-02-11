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

export interface DetectionResult {
  provider: Provider;
  installed: boolean;
  methods: string[];
  projectDetected: boolean;
}

function checkBinary(binary: string): boolean {
  try {
    execFileSync("which", [binary], { stdio: "pipe" });
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

/** Detect if a single provider is installed */
export function detectProvider(provider: Provider): DetectionResult {
  const matchedMethods: string[] = [];
  const detection = provider.detection;

  for (const method of detection.methods) {
    switch (method) {
      case "binary":
        if (detection.binary && checkBinary(detection.binary)) {
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

/** Detect all installed providers */
export function detectAllProviders(): DetectionResult[] {
  const providers = getAllProviders();
  return providers.map(detectProvider);
}

/** Get only installed providers */
export function getInstalledProviders(): Provider[] {
  return detectAllProviders()
    .filter((r) => r.installed)
    .map((r) => r.provider);
}

/** Detect providers with project-level presence */
export function detectProjectProviders(projectDir: string): DetectionResult[] {
  const results = detectAllProviders();
  return results.map((r) => ({
    ...r,
    projectDetected: detectProjectProvider(r.provider, projectDir),
  }));
}
