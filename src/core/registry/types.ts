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
}

export interface ProviderRegistry {
  version: string;
  lastUpdated: string;
  providers: Record<string, RegistryProvider>;
}
