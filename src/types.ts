/**
 * CAAMP - Central AI Agent Managed Packages
 * Core type definitions
 */

// ── Config Formats ──────────────────────────────────────────────────

export type ConfigFormat = "json" | "jsonc" | "yaml" | "toml";

// ── Transport Types ─────────────────────────────────────────────────

export type TransportType = "stdio" | "sse" | "http";

// ── Detection ───────────────────────────────────────────────────────

export type DetectionMethod = "binary" | "directory" | "appBundle" | "flatpak";

export interface DetectionConfig {
  methods: DetectionMethod[];
  binary?: string;
  directories?: string[];
  appBundle?: string;
  flatpakId?: string;
}

// ── Provider ────────────────────────────────────────────────────────

export type ProviderPriority = "high" | "medium" | "low";
export type ProviderStatus = "active" | "beta" | "deprecated" | "planned";

export interface Provider {
  id: string;
  toolName: string;
  vendor: string;
  agentFlag: string;
  aliases: string[];

  pathGlobal: string;
  pathProject: string;

  instructFile: string;

  configKey: string;
  configFormat: ConfigFormat;
  configPathGlobal: string;
  configPathProject: string | null;

  pathSkills: string;
  pathProjectSkills: string;

  detection: DetectionConfig;

  supportedTransports: TransportType[];
  supportsHeaders: boolean;

  priority: ProviderPriority;
  status: ProviderStatus;
  agentSkillsCompatible: boolean;
}

// ── MCP Server Config (Canonical) ───────────────────────────────────

export interface McpServerConfig {
  type?: TransportType;
  url?: string;
  headers?: Record<string, string>;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

// ── Source Parsing ───────────────────────────────────────────────────

export type SourceType = "remote" | "package" | "command" | "github" | "gitlab" | "local";

export interface ParsedSource {
  type: SourceType;
  value: string;
  inferredName: string;
  owner?: string;
  repo?: string;
  path?: string;
  ref?: string;
}

// ── Skills ──────────────────────────────────────────────────────────

export interface SkillMetadata {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  allowedTools?: string[];
  version?: string;
}

export interface SkillEntry {
  name: string;
  scopedName: string;
  path: string;
  metadata: SkillMetadata;
  source?: string;
}

// ── Lock File ───────────────────────────────────────────────────────

export interface LockEntry {
  name: string;
  scopedName: string;
  source: string;
  sourceType: SourceType;
  version?: string;
  installedAt: string;
  updatedAt?: string;
  agents: string[];
  canonicalPath: string;
  isGlobal: boolean;
  projectDir?: string;
}

export interface CaampLockFile {
  version: 1;
  skills: Record<string, LockEntry>;
  mcpServers: Record<string, LockEntry>;
  lastSelectedAgents?: string[];
}

// ── Marketplace ─────────────────────────────────────────────────────

export interface MarketplaceSkill {
  id: string;
  name: string;
  scopedName: string;
  description: string;
  author: string;
  stars: number;
  forks: number;
  githubUrl: string;
  repoFullName: string;
  path: string;
  category?: string;
  hasContent: boolean;
}

export interface MarketplaceSearchResult {
  skills: MarketplaceSkill[];
  total: number;
  limit: number;
  offset: number;
}

// ── Audit ───────────────────────────────────────────────────────────

export type AuditSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface AuditRule {
  id: string;
  name: string;
  description: string;
  severity: AuditSeverity;
  category: string;
  pattern: RegExp;
}

export interface AuditFinding {
  rule: AuditRule;
  line: number;
  column: number;
  match: string;
  context: string;
}

export interface AuditResult {
  file: string;
  findings: AuditFinding[];
  score: number;
  passed: boolean;
}

// ── Instructions ────────────────────────────────────────────────────

export type InjectionStatus = "current" | "outdated" | "missing" | "none";

export interface InjectionCheckResult {
  file: string;
  provider: string;
  status: InjectionStatus;
  fileExists: boolean;
}

// ── MCP Server Entry (list results) ─────────────────────────────────

export interface McpServerEntry {
  name: string;
  providerId: string;
  providerName: string;
  scope: "project" | "global";
  configPath: string;
  config: Record<string, unknown>;
}

// ── CLI Options ─────────────────────────────────────────────────────

export interface GlobalOptions {
  agent?: string[];
  global?: boolean;
  yes?: boolean;
  all?: boolean;
  json?: boolean;
  dryRun?: boolean;
}
