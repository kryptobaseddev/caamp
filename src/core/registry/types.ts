/**
 * Provider registry types
 *
 * These types map directly to the providers/registry.json schema.
 * The runtime Provider interface (in src/types.ts) is resolved from these
 * with platform-specific path expansion.
 */

export interface RegistryDetection {
  methods: string[];
  binary?: string;
  directories?: string[];
  appBundle?: string;
  flatpakId?: string;
}

export interface RegistryProvider {
  id: string;
  toolName: string;
  vendor: string;
  agentFlag: string;
  aliases: string[];

  pathGlobal: string;
  pathProject: string;

  instructFile: string;

  configKey: string;
  configFormat: string;
  configPathGlobal: string;
  configPathProject: string | null;

  pathSkills: string;
  pathProjectSkills: string;

  detection: RegistryDetection;

  supportedTransports: string[];
  supportsHeaders: boolean;

  priority: string;
  status: string;
  agentSkillsCompatible: boolean;

  capabilities?: RegistryCapabilities;
}

// ── Capability Types (raw JSON schema) ─────────────────────────────

export type SkillsPrecedence =
  | "vendor-only"
  | "agents-canonical"
  | "agents-first"
  | "agents-supported"
  | "vendor-global-agents-project";

export interface RegistrySkillsCapability {
  agentsGlobalPath: string | null;
  agentsProjectPath: string | null;
  precedence: SkillsPrecedence;
}

/**
 * @deprecated Use `CanonicalHookEvent` from `../hooks/types.js` for the
 * normalized CAAMP taxonomy. This type remains for backward compatibility
 * with registry.json's `capabilities.hooks.supported` string arrays.
 */
export type HookEvent = string;

export interface RegistryHooksCapability {
  supported: string[];
  hookConfigPath: string | null;
  hookFormat: string | null;
}

export type SpawnMechanism = "native" | "mcp" | "cli" | "api";

export interface RegistrySpawnCapability {
  supportsSubagents: boolean;
  supportsProgrammaticSpawn: boolean;
  supportsInterAgentComms: boolean;
  supportsParallelSpawn: boolean;
  spawnMechanism: string | null;
}

export interface RegistryCapabilities {
  skills?: RegistrySkillsCapability;
  hooks?: RegistryHooksCapability;
  spawn?: RegistrySpawnCapability;
}

export interface ProviderRegistry {
  version: string;
  lastUpdated: string;
  providers: Record<string, RegistryProvider>;
}
