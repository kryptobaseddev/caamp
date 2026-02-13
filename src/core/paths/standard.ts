import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type { Provider } from "../../types.js";

export type PathScope = "project" | "global";

export interface PlatformLocations {
  home: string;
  config: string;
  vscodeConfig: string;
  zedConfig: string;
  claudeDesktopConfig: string;
  applications: string[];
}

export function getPlatformLocations(): PlatformLocations {
  const home = homedir();
  const platform = process.platform;

  if (platform === "win32") {
    const appData = process.env["APPDATA"] ?? join(home, "AppData", "Roaming");
    return {
      home,
      config: appData,
      vscodeConfig: join(appData, "Code", "User"),
      zedConfig: join(appData, "Zed"),
      claudeDesktopConfig: join(appData, "Claude"),
      applications: [],
    };
  }

  if (platform === "darwin") {
    const config = process.env["XDG_CONFIG_HOME"] ?? join(home, ".config");
    return {
      home,
      config,
      vscodeConfig: join(home, "Library", "Application Support", "Code", "User"),
      zedConfig: join(home, "Library", "Application Support", "Zed"),
      claudeDesktopConfig: join(home, "Library", "Application Support", "Claude"),
      applications: ["/Applications", join(home, "Applications")],
    };
  }

  const config = process.env["XDG_CONFIG_HOME"] ?? join(home, ".config");
  return {
    home,
    config,
    vscodeConfig: join(config, "Code", "User"),
    zedConfig: join(config, "zed"),
    claudeDesktopConfig: join(config, "Claude"),
    applications: [],
  };
}

function normalizeHomeOverride(value: string): string {
  const home = homedir();
  const trimmed = value.trim();
  if (trimmed.startsWith("~/")) {
    return join(home, trimmed.slice(2));
  }
  if (trimmed === "~") {
    return home;
  }
  if (isAbsolute(trimmed)) {
    return resolve(trimmed);
  }
  return resolve(home, trimmed);
}

export function getAgentsHome(): string {
  const override = process.env["AGENTS_HOME"];
  if (override && override.trim().length > 0) {
    return normalizeHomeOverride(override);
  }
  return join(homedir(), ".agents");
}

export function getProjectAgentsDir(projectRoot = process.cwd()): string {
  return join(projectRoot, ".agents");
}

export function resolveProjectPath(relativePath: string, projectDir = process.cwd()): string {
  return join(projectDir, relativePath);
}

export function getCanonicalSkillsDir(): string {
  return join(getAgentsHome(), "skills");
}

export function getLockFilePath(): string {
  return join(getAgentsHome(), ".caamp-lock.json");
}

export function resolveRegistryTemplatePath(template: string): string {
  const locations = getPlatformLocations();
  return template
    .replace(/\$HOME/g, locations.home)
    .replace(/\$CONFIG/g, locations.config)
    .replace(/\$VSCODE_CONFIG/g, locations.vscodeConfig)
    .replace(/\$ZED_CONFIG/g, locations.zedConfig)
    .replace(/\$CLAUDE_DESKTOP_CONFIG/g, locations.claudeDesktopConfig)
    .replace(/\$AGENTS_HOME/g, getAgentsHome());
}

export function resolveProviderConfigPath(
  provider: Provider,
  scope: PathScope,
  projectDir = process.cwd(),
): string | null {
  if (scope === "global") {
    return provider.configPathGlobal;
  }
  if (!provider.configPathProject) {
    return null;
  }
  return resolveProjectPath(provider.configPathProject, projectDir);
}

export function resolvePreferredConfigScope(provider: Provider, useGlobalFlag?: boolean): PathScope {
  if (useGlobalFlag) {
    return "global";
  }
  return provider.configPathProject ? "project" : "global";
}

export function resolveProviderSkillsDir(
  provider: Provider,
  scope: PathScope,
  projectDir = process.cwd(),
): string {
  if (scope === "global") {
    return provider.pathSkills;
  }
  return resolveProjectPath(provider.pathProjectSkills, projectDir);
}

export function resolveProviderProjectPath(provider: Provider, projectDir = process.cwd()): string {
  return resolveProjectPath(provider.pathProject, projectDir);
}

export function resolveProvidersRegistryPath(startDir: string): string {
  const candidates = [
    join(startDir, "..", "..", "..", "providers", "registry.json"),
    join(startDir, "..", "providers", "registry.json"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  let current = startDir;
  for (let i = 0; i < 8; i += 1) {
    const candidate = join(current, "providers", "registry.json");
    if (existsSync(candidate)) {
      return candidate;
    }
    current = dirname(current);
  }

  throw new Error(`Cannot find providers/registry.json (searched from ${startDir})`);
}

export function normalizeSkillSubPath(path: string | undefined): string | undefined {
  if (!path) return undefined;
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/SKILL\.md$/i, "").trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function buildSkillSubPathCandidates(
  marketplacePath: string | undefined,
  parsedPath: string | undefined,
): (string | undefined)[] {
  const candidates: (string | undefined)[] = [];
  const base = normalizeSkillSubPath(marketplacePath);
  const parsed = normalizeSkillSubPath(parsedPath);

  if (base) candidates.push(base);
  if (parsed) candidates.push(parsed);

  const knownPrefixes = [".agents", ".claude"];
  for (const value of [base, parsed]) {
    if (!value || !value.startsWith("skills/")) continue;
    for (const prefix of knownPrefixes) {
      candidates.push(`${prefix}/${value}`);
    }
  }

  if (candidates.length === 0) {
    candidates.push(undefined);
  }

  return Array.from(new Set(candidates));
}
