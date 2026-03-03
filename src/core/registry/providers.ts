/**
 * Provider registry loader
 *
 * Loads providers from providers/registry.json and resolves
 * platform-specific paths at runtime.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ConfigFormat,
  DetectionMethod,
  Provider,
  ProviderCapabilities,
  ProviderHooksCapability,
  ProviderPriority,
  ProviderSkillsCapability,
  ProviderSpawnCapability,
  ProviderStatus,
  TransportType,
} from "../../types.js";
import { type PathScope, resolveProvidersRegistryPath, resolveProviderSkillsDir, resolveRegistryTemplatePath } from "../paths/standard.js";
import type { HookEvent, ProviderRegistry, RegistryCapabilities, RegistryProvider, SkillsPrecedence, SpawnMechanism } from "./types.js";

// ── Capability Defaults ──────────────────────────────────────────────

const DEFAULT_SKILLS_CAPABILITY: ProviderSkillsCapability = {
  agentsGlobalPath: null,
  agentsProjectPath: null,
  precedence: "vendor-only",
};

const DEFAULT_HOOKS_CAPABILITY: ProviderHooksCapability = {
  supported: [],
  hookConfigPath: null,
  hookFormat: null,
};

const DEFAULT_SPAWN_CAPABILITY: ProviderSpawnCapability = {
  supportsSubagents: false,
  supportsProgrammaticSpawn: false,
  supportsInterAgentComms: false,
  supportsParallelSpawn: false,
  spawnMechanism: null,
};

function resolveCapabilities(raw?: RegistryCapabilities): ProviderCapabilities {
  const skills: ProviderSkillsCapability = raw?.skills
    ? {
        agentsGlobalPath: raw.skills.agentsGlobalPath
          ? resolveRegistryTemplatePath(raw.skills.agentsGlobalPath)
          : null,
        agentsProjectPath: raw.skills.agentsProjectPath,
        precedence: raw.skills.precedence,
      }
    : { ...DEFAULT_SKILLS_CAPABILITY };

  const hooks: ProviderHooksCapability = raw?.hooks
    ? {
        supported: raw.hooks.supported as HookEvent[],
        hookConfigPath: raw.hooks.hookConfigPath
          ? resolveRegistryTemplatePath(raw.hooks.hookConfigPath)
          : null,
        hookFormat: raw.hooks.hookFormat as ProviderHooksCapability["hookFormat"],
      }
    : { ...DEFAULT_HOOKS_CAPABILITY, supported: [] };

  const spawn: ProviderSpawnCapability = raw?.spawn
    ? {
        supportsSubagents: raw.spawn.supportsSubagents,
        supportsProgrammaticSpawn: raw.spawn.supportsProgrammaticSpawn,
        supportsInterAgentComms: raw.spawn.supportsInterAgentComms,
        supportsParallelSpawn: raw.spawn.supportsParallelSpawn,
        spawnMechanism: raw.spawn.spawnMechanism as SpawnMechanism | null,
      }
    : { ...DEFAULT_SPAWN_CAPABILITY };

  return { skills, hooks, spawn };
}

function findRegistryPath(): string {
  const thisDir = dirname(fileURLToPath(import.meta.url));
  return resolveProvidersRegistryPath(thisDir);
}

let _registry: ProviderRegistry | null = null;
let _providers: Map<string, Provider> | null = null;
let _aliasMap: Map<string, string> | null = null;

function resolveProvider(raw: RegistryProvider): Provider {
  return {
    id: raw.id,
    toolName: raw.toolName,
    vendor: raw.vendor,
    agentFlag: raw.agentFlag,
    aliases: raw.aliases,
    pathGlobal: resolveRegistryTemplatePath(raw.pathGlobal),
    pathProject: raw.pathProject,
    instructFile: raw.instructFile,
    configKey: raw.configKey,
    configFormat: raw.configFormat as ConfigFormat,
    configPathGlobal: resolveRegistryTemplatePath(raw.configPathGlobal),
    configPathProject: raw.configPathProject,
    pathSkills: resolveRegistryTemplatePath(raw.pathSkills),
    pathProjectSkills: raw.pathProjectSkills,
    detection: {
      methods: raw.detection.methods as DetectionMethod[],
      binary: raw.detection.binary,
      directories: raw.detection.directories?.map(resolveRegistryTemplatePath),
      appBundle: raw.detection.appBundle,
      flatpakId: raw.detection.flatpakId,
    },
    supportedTransports: raw.supportedTransports as TransportType[],
    supportsHeaders: raw.supportsHeaders,
    priority: raw.priority as ProviderPriority,
    status: raw.status as ProviderStatus,
    agentSkillsCompatible: raw.agentSkillsCompatible,
    capabilities: resolveCapabilities(raw.capabilities),
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

/**
 * Retrieve all registered providers with resolved platform paths.
 *
 * Providers are lazily loaded from `providers/registry.json` on first call
 * and cached for subsequent calls.
 *
 * @returns Array of all provider definitions
 *
 * @example
 * ```typescript
 * const providers = getAllProviders();
 * console.log(`${providers.length} providers registered`);
 * ```
 */
export function getAllProviders(): Provider[] {
  ensureProviders();
  if (!_providers) return [];
  return Array.from(_providers.values());
}

/**
 * Look up a provider by its ID or any of its aliases.
 *
 * @param idOrAlias - Provider ID (e.g. `"claude-code"`) or alias (e.g. `"claude"`)
 * @returns The matching provider, or `undefined` if not found
 *
 * @example
 * ```typescript
 * const provider = getProvider("claude");
 * // Returns the claude-code provider via alias resolution
 * ```
 */
export function getProvider(idOrAlias: string): Provider | undefined {
  ensureProviders();
  const resolved = _aliasMap?.get(idOrAlias) ?? idOrAlias;
  return _providers?.get(resolved);
}

/**
 * Resolve an alias to its canonical provider ID.
 *
 * If the input is already a canonical ID (or unrecognized), it is returned as-is.
 *
 * @param idOrAlias - Provider ID or alias to resolve
 * @returns The canonical provider ID
 *
 * @example
 * ```typescript
 * resolveAlias("claude"); // "claude-code"
 * resolveAlias("claude-code"); // "claude-code"
 * resolveAlias("unknown"); // "unknown"
 * ```
 */
export function resolveAlias(idOrAlias: string): string {
  ensureProviders();
  return _aliasMap?.get(idOrAlias) ?? idOrAlias;
}

/**
 * Filter providers by their priority tier.
 *
 * @param priority - Priority level to filter by (`"high"`, `"medium"`, or `"low"`)
 * @returns Array of providers matching the given priority
 *
 * @example
 * ```typescript
 * const highPriority = getProvidersByPriority("high");
 * ```
 */
export function getProvidersByPriority(priority: ProviderPriority): Provider[] {
  return getAllProviders().filter((p) => p.priority === priority);
}

/**
 * Filter providers by their lifecycle status.
 *
 * @param status - Status to filter by (`"active"`, `"beta"`, `"deprecated"`, or `"planned"`)
 * @returns Array of providers matching the given status
 *
 * @example
 * ```typescript
 * const active = getProvidersByStatus("active");
 * ```
 */
export function getProvidersByStatus(status: ProviderStatus): Provider[] {
  return getAllProviders().filter((p) => p.status === status);
}

/**
 * Filter providers that use a specific instruction file.
 *
 * Multiple providers often share the same instruction file (e.g. many use `"AGENTS.md"`).
 *
 * @param file - Instruction file name (e.g. `"CLAUDE.md"`, `"AGENTS.md"`)
 * @returns Array of providers that use the given instruction file
 *
 * @example
 * ```typescript
 * const claudeProviders = getProvidersByInstructFile("CLAUDE.md");
 * ```
 */
export function getProvidersByInstructFile(file: string): Provider[] {
  return getAllProviders().filter((p) => p.instructFile === file);
}

/**
 * Get the set of all unique instruction file names across all providers.
 *
 * @returns Array of unique instruction file names (e.g. `["CLAUDE.md", "AGENTS.md", "GEMINI.md"]`)
 *
 * @example
 * ```typescript
 * const files = getInstructionFiles();
 * // ["CLAUDE.md", "AGENTS.md", "GEMINI.md"]
 * ```
 */
export function getInstructionFiles(): string[] {
  const files = new Set<string>();
  for (const p of getAllProviders()) {
    files.add(p.instructFile);
  }
  return Array.from(files);
}

/**
 * Get the total number of registered providers.
 *
 * @returns Count of providers in the registry
 *
 * @example
 * ```typescript
 * console.log(`Registry has ${getProviderCount()} providers`);
 * ```
 */
export function getProviderCount(): number {
  ensureProviders();
  return _providers?.size ?? 0;
}

/**
 * Get the semantic version string of the provider registry.
 *
 * @returns Version string from `providers/registry.json` (e.g. `"1.0.0"`)
 *
 * @example
 * ```typescript
 * console.log(`Registry version: ${getRegistryVersion()}`);
 * ```
 */
export function getRegistryVersion(): string {
  return loadRegistry().version;
}

/**
 * Filter providers that support a specific hook event.
 *
 * @param event - Hook event to filter by (e.g. `"onToolComplete"`)
 * @returns Array of providers whose hooks capability includes the given event
 *
 * @example
 * ```typescript
 * const providers = getProvidersByHookEvent("onToolComplete");
 * ```
 */
export function getProvidersByHookEvent(event: HookEvent): Provider[] {
  return getAllProviders().filter((p) => p.capabilities.hooks.supported.includes(event));
}

/**
 * Get hook events common to all specified providers.
 *
 * If providerIds is provided, returns the intersection of their supported events.
 * If providerIds is undefined or empty, uses all providers.
 *
 * @param providerIds - Optional array of provider IDs to intersect
 * @returns Array of hook events supported by ALL specified providers
 *
 * @example
 * ```typescript
 * const common = getCommonHookEvents(["claude-code", "gemini-cli"]);
 * ```
 */
export function getCommonHookEvents(providerIds?: string[]): HookEvent[] {
  const providers = providerIds && providerIds.length > 0
    ? providerIds.map((id) => getProvider(id)).filter((p): p is Provider => p !== undefined)
    : getAllProviders();

  if (providers.length === 0) return [];

  const first = providers[0]!.capabilities.hooks.supported as HookEvent[];
  return first.filter((event) =>
    providers.every((p) => p.capabilities.hooks.supported.includes(event)),
  );
}

/**
 * Check whether a provider supports a specific capability via dot-path query.
 *
 * The dot-path addresses a value inside `provider.capabilities`. For boolean
 * fields the provider "supports" the capability when the value is `true`.
 * For non-boolean fields the provider "supports" it when the value is neither
 * `null` nor `undefined` (and, for arrays, non-empty).
 *
 * @param provider - Provider to inspect
 * @param dotPath  - Dot-delimited capability path (e.g. `"spawn.supportsSubagents"`, `"hooks.supported"`)
 * @returns `true` when the provider has the specified capability
 *
 * @example
 * ```typescript
 * const claude = getProvider("claude-code");
 * providerSupports(claude!, "spawn.supportsSubagents"); // true
 * ```
 */
export function providerSupports(provider: Provider, dotPath: string): boolean {
  const parts = dotPath.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = provider.capabilities;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return false;
    current = current[part];
  }
  if (typeof current === "boolean") return current;
  if (Array.isArray(current)) return current.length > 0;
  return current != null;
}

/**
 * Filter providers that support spawning subagents.
 *
 * @returns Array of providers where `capabilities.spawn.supportsSubagents === true`
 *
 * @example
 * ```typescript
 * const spawnCapable = getSpawnCapableProviders();
 * ```
 */
export function getSpawnCapableProviders(): Provider[] {
  return getAllProviders().filter((p) => p.capabilities.spawn.supportsSubagents);
}

/**
 * Filter providers by a specific boolean spawn capability flag.
 *
 * @param flag - One of the four boolean flags on {@link ProviderSpawnCapability}
 *              (`"supportsSubagents"`, `"supportsProgrammaticSpawn"`,
 *               `"supportsInterAgentComms"`, `"supportsParallelSpawn"`)
 * @returns Array of providers where the specified flag is `true`
 *
 * @example
 * ```typescript
 * const parallel = getProvidersBySpawnCapability("supportsParallelSpawn");
 * ```
 */
export function getProvidersBySpawnCapability(
  flag: keyof Omit<ProviderSpawnCapability, "spawnMechanism">,
): Provider[] {
  return getAllProviders().filter((p) => p.capabilities.spawn[flag] === true);
}

/** Reset cached data (for testing) */
export function resetRegistry(): void {
  _registry = null;
  _providers = null;
  _aliasMap = null;
}

// ── Skills Query Functions ──────────────────────────────────────────

/**
 * Filter providers by their skills precedence value.
 *
 * @param precedence - Skills precedence to filter by
 * @returns Array of providers matching the given precedence
 */
export function getProvidersBySkillsPrecedence(precedence: SkillsPrecedence): Provider[] {
  return getAllProviders().filter((p) => p.capabilities.skills.precedence === precedence);
}

/**
 * Get the effective skills paths for a provider, ordered by precedence.
 *
 * @param provider - Provider to resolve paths for
 * @param scope - Whether to resolve global or project paths
 * @param projectDir - Project directory for project-scope resolution
 * @returns Ordered array of paths with source and scope metadata
 */
export function getEffectiveSkillsPaths(
  provider: Provider,
  scope: PathScope,
  projectDir?: string,
): Array<{ path: string; source: string; scope: string }> {
  const vendorPath = resolveProviderSkillsDir(provider, scope, projectDir);
  const { precedence, agentsGlobalPath, agentsProjectPath } = provider.capabilities.skills;

  const resolveAgentsPath = (): string | null => {
    if (scope === "global" && agentsGlobalPath) return agentsGlobalPath;
    if (scope === "project" && agentsProjectPath && projectDir) {
      return join(projectDir, agentsProjectPath);
    }
    return null;
  };

  const agentsPath = resolveAgentsPath();
  const scopeLabel = scope === "global" ? "global" : "project";

  switch (precedence) {
    case "vendor-only":
      return [{ path: vendorPath, source: "vendor", scope: scopeLabel }];
    case "agents-canonical":
      return agentsPath ? [{ path: agentsPath, source: "agents", scope: scopeLabel }] : [];
    case "agents-first":
      return [
        ...(agentsPath ? [{ path: agentsPath, source: "agents", scope: scopeLabel }] : []),
        { path: vendorPath, source: "vendor", scope: scopeLabel },
      ];
    case "agents-supported":
      return [
        { path: vendorPath, source: "vendor", scope: scopeLabel },
        ...(agentsPath ? [{ path: agentsPath, source: "agents", scope: scopeLabel }] : []),
      ];
    case "vendor-global-agents-project":
      if (scope === "global") {
        return [{ path: vendorPath, source: "vendor", scope: "global" }];
      }
      return [
        ...(agentsPath ? [{ path: agentsPath, source: "agents", scope: "project" }] : []),
        { path: vendorPath, source: "vendor", scope: "project" },
      ];
    default:
      return [{ path: vendorPath, source: "vendor", scope: scopeLabel }];
  }
}

/**
 * Build a full skills map for all providers.
 *
 * @returns Array of skills map entries with provider ID, tool name, precedence, and paths
 */
export function buildSkillsMap(): Array<{
  providerId: string;
  toolName: string;
  precedence: SkillsPrecedence;
  paths: { global: string | null; project: string | null };
}> {
  return getAllProviders().map((p) => {
    const { precedence, agentsGlobalPath, agentsProjectPath } = p.capabilities.skills;
    const isVendorOnly = precedence === "vendor-only";
    return {
      providerId: p.id,
      toolName: p.toolName,
      precedence,
      paths: {
        global: isVendorOnly ? p.pathSkills : (agentsGlobalPath ?? null),
        project: isVendorOnly ? p.pathProjectSkills : (agentsProjectPath ?? null),
      },
    };
  });
}

/**
 * Get capabilities for a provider by ID or alias.
 *
 * @param idOrAlias - Provider ID or alias
 * @returns The provider's capabilities, or undefined if not found
 */
export function getProviderCapabilities(idOrAlias: string): ProviderCapabilities | undefined {
  return getProvider(idOrAlias)?.capabilities;
}

/**
 * Check if a provider supports a capability using ID/alias lookup.
 *
 * Convenience wrapper that resolves the provider first, then delegates
 * to the provider-level {@link providerSupports}.
 *
 * @param idOrAlias - Provider ID or alias
 * @param capabilityPath - Dot-path into capabilities (e.g. "spawn.supportsSubagents")
 * @returns true if the provider supports the capability, false otherwise
 */
export function providerSupportsById(idOrAlias: string, capabilityPath: string): boolean {
  const provider = getProvider(idOrAlias);
  if (!provider) return false;
  return providerSupports(provider, capabilityPath);
}
