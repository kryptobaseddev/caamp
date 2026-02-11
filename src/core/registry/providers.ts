/**
 * Provider registry loader
 *
 * Loads providers from providers/registry.json and resolves
 * platform-specific paths at runtime.
 */

import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Provider, ConfigFormat, TransportType, ProviderPriority, ProviderStatus, DetectionMethod } from "../../types.js";
import type { ProviderRegistry, RegistryProvider } from "./types.js";

function findRegistryPath(): string {
  const thisDir = dirname(fileURLToPath(import.meta.url));

  // Development: src/core/registry/ -> ../../.. -> providers/registry.json
  const devPath = join(thisDir, "..", "..", "..", "providers", "registry.json");
  if (existsSync(devPath)) return devPath;

  // Bundled: dist/ -> .. -> providers/registry.json
  const distPath = join(thisDir, "..", "providers", "registry.json");
  if (existsSync(distPath)) return distPath;

  // Fallback: traverse up until we find it
  let dir = thisDir;
  for (let i = 0; i < 5; i++) {
    const candidate = join(dir, "providers", "registry.json");
    if (existsSync(candidate)) return candidate;
    dir = dirname(dir);
  }

  throw new Error(`Cannot find providers/registry.json (searched from ${thisDir})`);
}

let _registry: ProviderRegistry | null = null;
let _providers: Map<string, Provider> | null = null;
let _aliasMap: Map<string, string> | null = null;

function getPlatformPaths(): {
  config: string;
  vscodeConfig: string;
  zedConfig: string;
  claudeDesktopConfig: string;
} {
  const home = homedir();
  const platform = process.platform;

  if (platform === "win32") {
    const appData = process.env["APPDATA"] ?? join(home, "AppData", "Roaming");
    return {
      config: appData,
      vscodeConfig: join(appData, "Code", "User"),
      zedConfig: join(appData, "Zed"),
      claudeDesktopConfig: join(appData, "Claude"),
    };
  } else if (platform === "darwin") {
    return {
      config: process.env["XDG_CONFIG_HOME"] ?? join(home, ".config"),
      vscodeConfig: join(home, "Library", "Application Support", "Code", "User"),
      zedConfig: join(home, "Library", "Application Support", "Zed"),
      claudeDesktopConfig: join(home, "Library", "Application Support", "Claude"),
    };
  } else {
    const config = process.env["XDG_CONFIG_HOME"] ?? join(home, ".config");
    return {
      config,
      vscodeConfig: join(config, "Code", "User"),
      zedConfig: join(config, "zed"),
      claudeDesktopConfig: join(config, "Claude"),
    };
  }
}

function resolvePath(template: string): string {
  const home = homedir();
  const paths = getPlatformPaths();

  return template
    .replace(/\$HOME/g, home)
    .replace(/\$CONFIG/g, paths.config)
    .replace(/\$VSCODE_CONFIG/g, paths.vscodeConfig)
    .replace(/\$ZED_CONFIG/g, paths.zedConfig)
    .replace(/\$CLAUDE_DESKTOP_CONFIG/g, paths.claudeDesktopConfig);
}

function resolveProvider(raw: RegistryProvider): Provider {
  return {
    id: raw.id,
    toolName: raw.toolName,
    vendor: raw.vendor,
    agentFlag: raw.agentFlag,
    aliases: raw.aliases,
    pathGlobal: resolvePath(raw.pathGlobal),
    pathProject: raw.pathProject,
    instructFile: raw.instructFile,
    configKey: raw.configKey,
    configFormat: raw.configFormat as ConfigFormat,
    configPathGlobal: resolvePath(raw.configPathGlobal),
    configPathProject: raw.configPathProject,
    pathSkills: resolvePath(raw.pathSkills),
    pathProjectSkills: raw.pathProjectSkills,
    detection: {
      methods: raw.detection.methods as DetectionMethod[],
      binary: raw.detection.binary,
      directories: raw.detection.directories?.map(resolvePath),
      appBundle: raw.detection.appBundle,
      flatpakId: raw.detection.flatpakId,
    },
    supportedTransports: raw.supportedTransports as TransportType[],
    supportsHeaders: raw.supportsHeaders,
    priority: raw.priority as ProviderPriority,
    status: raw.status as ProviderStatus,
    agentSkillsCompatible: raw.agentSkillsCompatible,
  };
}

function loadRegistry(): ProviderRegistry {
  if (_registry) return _registry;

  const registryPath = findRegistryPath();
  const raw = readFileSync(registryPath, "utf-8");
  _registry = JSON.parse(raw) as ProviderRegistry;
  return _registry;
}

function ensureProviders(): void {
  if (_providers) return;

  const registry = loadRegistry();
  _providers = new Map<string, Provider>();
  _aliasMap = new Map<string, string>();

  for (const [id, raw] of Object.entries(registry.providers)) {
    const provider = resolveProvider(raw);
    _providers.set(id, provider);

    // Build alias map
    for (const alias of provider.aliases) {
      _aliasMap.set(alias, id);
    }
  }
}

/** Get all providers */
export function getAllProviders(): Provider[] {
  ensureProviders();
  return Array.from(_providers!.values());
}

/** Get a provider by ID or alias */
export function getProvider(idOrAlias: string): Provider | undefined {
  ensureProviders();
  const resolved = _aliasMap!.get(idOrAlias) ?? idOrAlias;
  return _providers!.get(resolved);
}

/** Resolve an alias to provider ID */
export function resolveAlias(idOrAlias: string): string {
  ensureProviders();
  return _aliasMap!.get(idOrAlias) ?? idOrAlias;
}

/** Get providers by priority tier */
export function getProvidersByPriority(priority: ProviderPriority): Provider[] {
  return getAllProviders().filter((p) => p.priority === priority);
}

/** Get providers by status */
export function getProvidersByStatus(status: ProviderStatus): Provider[] {
  return getAllProviders().filter((p) => p.status === status);
}

/** Get providers that use a specific instruction file */
export function getProvidersByInstructFile(file: string): Provider[] {
  return getAllProviders().filter((p) => p.instructFile === file);
}

/** Get all unique instruction files */
export function getInstructionFiles(): string[] {
  const files = new Set<string>();
  for (const p of getAllProviders()) {
    files.add(p.instructFile);
  }
  return Array.from(files);
}

/** Get provider count */
export function getProviderCount(): number {
  ensureProviders();
  return _providers!.size;
}

/** Get registry version */
export function getRegistryVersion(): string {
  return loadRegistry().version;
}

/** Reset cached data (for testing) */
export function resetRegistry(): void {
  _registry = null;
  _providers = null;
  _aliasMap = null;
}
