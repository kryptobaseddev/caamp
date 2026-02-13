/**
 * CAAMP - Central AI Agent Managed Packages
 * Core type definitions
 */

// ── Config Formats ──────────────────────────────────────────────────

/**
 * Supported configuration file formats.
 *
 * - `"json"` - Standard JSON
 * - `"jsonc"` - JSON with comments (comment-preserving via jsonc-parser)
 * - `"yaml"` - YAML (via js-yaml)
 * - `"toml"` - TOML (via @iarna/toml)
 *
 * @example
 * ```typescript
 * const format: ConfigFormat = "jsonc";
 * ```
 */
export type ConfigFormat = "json" | "jsonc" | "yaml" | "toml";

// ── Transport Types ─────────────────────────────────────────────────

/**
 * MCP server transport protocol type.
 *
 * - `"stdio"` - Standard input/output (local process)
 * - `"sse"` - Server-Sent Events (remote)
 * - `"http"` - HTTP/Streamable HTTP (remote)
 *
 * @example
 * ```typescript
 * const transport: TransportType = "stdio";
 * ```
 */
export type TransportType = "stdio" | "sse" | "http";

// ── Detection ───────────────────────────────────────────────────────

/**
 * Method used to detect whether an AI agent is installed on the system.
 *
 * - `"binary"` - Check if a CLI binary exists on PATH
 * - `"directory"` - Check if known config/data directories exist
 * - `"appBundle"` - Check for macOS .app bundle in standard app directories
 * - `"flatpak"` - Check for Flatpak installation on Linux
 */
export type DetectionMethod = "binary" | "directory" | "appBundle" | "flatpak";

/**
 * Configuration for detecting whether a provider is installed.
 *
 * @example
 * ```typescript
 * const config: DetectionConfig = {
 *   methods: ["binary", "directory"],
 *   binary: "claude",
 *   directories: ["~/.config/claude"],
 * };
 * ```
 */
export interface DetectionConfig {
  /** Detection methods to try, in order. */
  methods: DetectionMethod[];
  /** Binary name to look up on PATH (for `"binary"` method). */
  binary?: string;
  /** Directories to check for existence (for `"directory"` method). */
  directories?: string[];
  /** macOS .app bundle name (for `"appBundle"` method). */
  appBundle?: string;
  /** Flatpak application ID (for `"flatpak"` method). */
  flatpakId?: string;
}

// ── Provider ────────────────────────────────────────────────────────

/**
 * Priority tier for a provider, used for sorting and default selection.
 *
 * - `"high"` - Major, widely-used agents
 * - `"medium"` - Established but less common agents
 * - `"low"` - Niche or experimental agents
 */
export type ProviderPriority = "high" | "medium" | "low";

/**
 * Lifecycle status of a provider in the registry.
 *
 * - `"active"` - Fully supported
 * - `"beta"` - Supported but may have rough edges
 * - `"deprecated"` - Still present but no longer recommended
 * - `"planned"` - Not yet implemented
 */
export type ProviderStatus = "active" | "beta" | "deprecated" | "planned";

/**
 * A resolved AI agent provider definition with platform-specific paths.
 *
 * Providers are loaded from `providers/registry.json` and resolved at runtime
 * to expand platform-specific path variables (`$HOME`, `$CONFIG`, etc.).
 *
 * @example
 * ```typescript
 * const provider = getProvider("claude-code");
 * if (provider) {
 *   console.log(provider.configPathGlobal);
 * }
 * ```
 */
export interface Provider {
  /** Unique provider identifier (e.g. `"claude-code"`). */
  id: string;
  /** Human-readable tool name (e.g. `"Claude Code"`). */
  toolName: string;
  /** Vendor/company name (e.g. `"Anthropic"`). */
  vendor: string;
  /** CLI flag name for `--agent` selection. */
  agentFlag: string;
  /** Alternative names that resolve to this provider. */
  aliases: string[];

  /** Resolved global instruction file directory path. */
  pathGlobal: string;
  /** Project-relative instruction file directory path. */
  pathProject: string;

  /** Instruction file name (e.g. `"CLAUDE.md"`, `"AGENTS.md"`). */
  instructFile: string;

  /** Dot-notation key path for MCP server config (e.g. `"mcpServers"`). */
  configKey: string;
  /** Config file format used by this provider. */
  configFormat: ConfigFormat;
  /** Resolved global config file path. */
  configPathGlobal: string;
  /** Project-relative config file path, or `null` if unsupported. */
  configPathProject: string | null;

  /** Resolved global skills directory path. */
  pathSkills: string;
  /** Project-relative skills directory path. */
  pathProjectSkills: string;

  /** Detection configuration for auto-discovering this provider. */
  detection: DetectionConfig;

  /** MCP transport protocols this provider supports. */
  supportedTransports: TransportType[];
  /** Whether the provider supports custom HTTP headers for remote MCP servers. */
  supportsHeaders: boolean;

  /** Priority tier for sorting and default selection. */
  priority: ProviderPriority;
  /** Lifecycle status in the registry. */
  status: ProviderStatus;
  /** Whether the provider is compatible with the Agent Skills standard. */
  agentSkillsCompatible: boolean;
}

// ── MCP Server Config (Canonical) ───────────────────────────────────

/**
 * Canonical MCP server configuration.
 *
 * Represents either a remote server (via `url`) or a local stdio process
 * (via `command` + `args`). This canonical format is transformed to
 * provider-specific shapes before writing to config files.
 *
 * @example
 * ```typescript
 * // Remote server
 * const remote: McpServerConfig = {
 *   type: "http",
 *   url: "https://mcp.example.com/sse",
 * };
 *
 * // Local stdio server
 * const local: McpServerConfig = {
 *   command: "npx",
 *   args: ["-y", "@modelcontextprotocol/server-filesystem"],
 * };
 * ```
 */
export interface McpServerConfig {
  /** Transport type (`"stdio"`, `"sse"`, or `"http"`). */
  type?: TransportType;
  /** URL for remote MCP servers. */
  url?: string;
  /** HTTP headers for remote MCP servers. */
  headers?: Record<string, string>;
  /** Command to run for stdio MCP servers. */
  command?: string;
  /** Arguments for the stdio command. */
  args?: string[];
  /** Environment variables for the stdio process. */
  env?: Record<string, string>;
}

// ── Source Parsing ───────────────────────────────────────────────────

/**
 * Classified type of an MCP server or skill source.
 *
 * - `"remote"` - HTTP/HTTPS URL to a remote MCP server
 * - `"package"` - npm package name
 * - `"command"` - Shell command string
 * - `"github"` - GitHub repository (URL or shorthand)
 * - `"gitlab"` - GitLab repository URL
 * - `"local"` - Local filesystem path
 */
export type SourceType = "remote" | "package" | "command" | "github" | "gitlab" | "local";

/**
 * Result of parsing a source string into its typed components.
 *
 * @example
 * ```typescript
 * const parsed: ParsedSource = {
 *   type: "github",
 *   value: "https://github.com/owner/repo",
 *   inferredName: "repo",
 *   owner: "owner",
 *   repo: "repo",
 * };
 * ```
 */
export interface ParsedSource {
  /** Classified source type. */
  type: SourceType;
  /** Original or normalized source value. */
  value: string;
  /** Display name inferred from the source. */
  inferredName: string;
  /** Repository owner (for GitHub/GitLab sources). */
  owner?: string;
  /** Repository name (for GitHub/GitLab sources). */
  repo?: string;
  /** Path within the repository (for GitHub/GitLab sources). */
  path?: string;
  /** Git ref / branch / tag (for GitHub/GitLab sources). */
  ref?: string;
}

// ── Skills ──────────────────────────────────────────────────────────

/**
 * Metadata extracted from a SKILL.md frontmatter.
 *
 * @example
 * ```typescript
 * const meta: SkillMetadata = {
 *   name: "my-skill",
 *   description: "A useful skill for code generation",
 *   version: "1.0.0",
 * };
 * ```
 */
export interface SkillMetadata {
  /** Skill name (lowercase, hyphens only). */
  name: string;
  /** Human-readable description. */
  description: string;
  /** SPDX license identifier. */
  license?: string;
  /** Compatibility notes (e.g. agent versions). */
  compatibility?: string;
  /** Arbitrary key-value metadata. */
  metadata?: Record<string, string>;
  /** List of tools the skill is allowed to use. */
  allowedTools?: string[];
  /** Semantic version string. */
  version?: string;
}

/**
 * A discovered skill entry with its location and metadata.
 *
 * @example
 * ```typescript
 * import { getCanonicalSkillsDir } from "./core/paths/standard.js";
 * import { join } from "node:path";
 *
 * const entry: SkillEntry = {
 *   name: "my-skill",
 *   scopedName: "my-skill",
 *   path: join(getCanonicalSkillsDir(), "my-skill"),
 *   metadata: { name: "my-skill", description: "A skill" },
 * };
 * ```
 */
export interface SkillEntry {
  /** Skill name. */
  name: string;
  /** Scoped name (may include marketplace scope). */
  scopedName: string;
  /** Absolute path to the skill directory. */
  path: string;
  /** Parsed SKILL.md frontmatter metadata. */
  metadata: SkillMetadata;
  /** Original source from which the skill was installed. */
  source?: string;
}

// ── Lock File ───────────────────────────────────────────────────────

/**
 * A single entry in the CAAMP lock file tracking an installed skill or MCP server.
 *
 * @example
 * ```typescript
 * import { getCanonicalSkillsDir } from "./core/paths/standard.js";
 * import { join } from "node:path";
 *
 * const entry: LockEntry = {
 *   name: "my-skill",
 *   scopedName: "my-skill",
 *   source: "https://github.com/owner/repo",
 *   sourceType: "github",
 *   installedAt: "2025-01-15T10:30:00.000Z",
 *   agents: ["claude-code", "cursor"],
 *   canonicalPath: join(getCanonicalSkillsDir(), "my-skill"),
 *   isGlobal: true,
 * };
 * ```
 */
export interface LockEntry {
  /** Skill or server name. */
  name: string;
  /** Scoped name (may include marketplace scope). */
  scopedName: string;
  /** Original source string. */
  source: string;
  /** Classified source type. */
  sourceType: SourceType;
  /** Version string or commit SHA. */
  version?: string;
  /** ISO 8601 timestamp of first installation. */
  installedAt: string;
  /** ISO 8601 timestamp of last update. */
  updatedAt?: string;
  /** Provider IDs this entry is linked to. */
  agents: string[];
  /** Absolute path to canonical installation. */
  canonicalPath: string;
  /** Whether this was installed globally. */
  isGlobal: boolean;
  /** Project directory (for project-scoped installs). */
  projectDir?: string;
}

/**
 * The CAAMP lock file structure, stored at the resolved canonical lock path.
 *
 * Tracks all installed skills and MCP servers along with their sources,
 * versions, and linked agents.
 *
 * @example
 * ```typescript
 * const lock: CaampLockFile = {
 *   version: 1,
 *   skills: {},
 *   mcpServers: {},
 *   lastSelectedAgents: ["claude-code"],
 * };
 * ```
 */
export interface CaampLockFile {
  /** Lock file schema version. */
  version: 1;
  /** Installed skills keyed by name. */
  skills: Record<string, LockEntry>;
  /** Installed MCP servers keyed by name. */
  mcpServers: Record<string, LockEntry>;
  /** Last selected agent IDs for UX persistence. */
  lastSelectedAgents?: string[];
}

// ── Marketplace ─────────────────────────────────────────────────────

/**
 * A skill listing from a marketplace search result.
 *
 * @example
 * ```typescript
 * const skill: MarketplaceSkill = {
 *   id: "abc123",
 *   name: "my-skill",
 *   scopedName: "@author/my-skill",
 *   description: "A useful skill",
 *   author: "author",
 *   stars: 42,
 *   forks: 5,
 *   githubUrl: "https://github.com/author/my-skill",
 *   repoFullName: "author/my-skill",
 *   path: "/",
 *   hasContent: true,
 * };
 * ```
 */
export interface MarketplaceSkill {
  /** Unique marketplace identifier. */
  id: string;
  /** Skill name. */
  name: string;
  /** Scoped name (e.g. `"@author/my-skill"`). */
  scopedName: string;
  /** Short description. */
  description: string;
  /** Author / publisher name. */
  author: string;
  /** GitHub star count. */
  stars: number;
  /** GitHub fork count. */
  forks: number;
  /** GitHub repository URL. */
  githubUrl: string;
  /** Full `owner/repo` name. */
  repoFullName: string;
  /** Path within the repository. */
  path: string;
  /** Optional category tag. */
  category?: string;
  /** Whether SKILL.md content was fetched. */
  hasContent: boolean;
}

/**
 * Paginated search results from a marketplace API.
 *
 * @example
 * ```typescript
 * const result: MarketplaceSearchResult = {
 *   skills: [],
 *   total: 0,
 *   limit: 20,
 *   offset: 0,
 * };
 * ```
 */
export interface MarketplaceSearchResult {
  /** Array of matching skills. */
  skills: MarketplaceSkill[];
  /** Total number of matching results. */
  total: number;
  /** Maximum results per page. */
  limit: number;
  /** Offset into the result set. */
  offset: number;
}

// ── Audit ───────────────────────────────────────────────────────────

/**
 * Severity level for a security audit finding.
 *
 * Ordered from most to least severe: `"critical"` > `"high"` > `"medium"` > `"low"` > `"info"`.
 */
export type AuditSeverity = "critical" | "high" | "medium" | "low" | "info";

/**
 * A security audit rule definition with a regex pattern to match against skill content.
 *
 * @example
 * ```typescript
 * const rule: AuditRule = {
 *   id: "SEC001",
 *   name: "shell-injection",
 *   description: "Potential shell injection vector",
 *   severity: "critical",
 *   category: "injection",
 *   pattern: /rm\s+-rf\s+\//,
 * };
 * ```
 */
export interface AuditRule {
  /** Unique rule identifier (e.g. `"SEC001"`). */
  id: string;
  /** Rule name. */
  name: string;
  /** Human-readable description of what the rule detects. */
  description: string;
  /** Severity level of findings from this rule. */
  severity: AuditSeverity;
  /** Category grouping (e.g. `"injection"`, `"exfiltration"`). */
  category: string;
  /** Regex pattern to match against each line of content. */
  pattern: RegExp;
}

/**
 * A single finding from a security audit scan, with line-level location.
 *
 * @example
 * ```typescript
 * const finding: AuditFinding = {
 *   rule: myRule,
 *   line: 42,
 *   column: 10,
 *   match: "rm -rf /",
 *   context: "Execute: rm -rf / to clean up",
 * };
 * ```
 */
export interface AuditFinding {
  /** The rule that triggered this finding. */
  rule: AuditRule;
  /** Line number (1-based). */
  line: number;
  /** Column number (1-based). */
  column: number;
  /** The matched text. */
  match: string;
  /** The full line of text for context. */
  context: string;
}

/**
 * Aggregate audit result for a single file.
 *
 * Includes a security score (100 = clean, 0 = very dangerous) and a pass/fail
 * status based on the presence of critical or high severity findings.
 *
 * @example
 * ```typescript
 * const result: AuditResult = {
 *   file: "/path/to/SKILL.md",
 *   findings: [],
 *   score: 100,
 *   passed: true,
 * };
 * ```
 */
export interface AuditResult {
  /** Path to the scanned file. */
  file: string;
  /** All findings for this file. */
  findings: AuditFinding[];
  /** Security score from 0 (dangerous) to 100 (clean). */
  score: number;
  /** Whether the file passed the audit (no critical/high findings). */
  passed: boolean;
}

// ── Instructions ────────────────────────────────────────────────────

/**
 * Status of a CAAMP injection block in an instruction file.
 *
 * - `"current"` - Injection block exists and matches expected content
 * - `"outdated"` - Injection block exists but content differs
 * - `"missing"` - Instruction file does not exist
 * - `"none"` - File exists but has no CAAMP injection block
 */
export type InjectionStatus = "current" | "outdated" | "missing" | "none";

/**
 * Result of checking a single instruction file for CAAMP injection status.
 *
 * @example
 * ```typescript
 * const check: InjectionCheckResult = {
 *   file: "/project/CLAUDE.md",
 *   provider: "claude-code",
 *   status: "current",
 *   fileExists: true,
 * };
 * ```
 */
export interface InjectionCheckResult {
  /** Absolute path to the instruction file. */
  file: string;
  /** Provider ID that owns this instruction file. */
  provider: string;
  /** Current injection status. */
  status: InjectionStatus;
  /** Whether the instruction file exists on disk. */
  fileExists: boolean;
}

// ── MCP Server Entry (list results) ─────────────────────────────────

/**
 * An MCP server entry read from a provider's config file.
 *
 * Returned by {@link listMcpServers} and {@link listAllMcpServers}.
 *
 * @example
 * ```typescript
 * const entry: McpServerEntry = {
 *   name: "filesystem",
 *   providerId: "claude-code",
 *   providerName: "Claude Code",
 *   scope: "project",
 *   configPath: "/project/<provider-project-config>",
 *   config: { command: "npx", args: ["-y", "@mcp/server-filesystem"] },
 * };
 * ```
 */
export interface McpServerEntry {
  /** Server name (the key in the config file). */
  name: string;
  /** Provider ID that owns this config file. */
  providerId: string;
  /** Human-readable provider name. */
  providerName: string;
  /** Whether from project or global config. */
  scope: "project" | "global";
  /** Absolute path to the config file. */
  configPath: string;
  /** Raw server configuration object. */
  config: Record<string, unknown>;
}

// ── CLI Options ─────────────────────────────────────────────────────

/**
 * Global CLI options shared across all CAAMP commands.
 *
 * @example
 * ```typescript
 * const opts: GlobalOptions = {
 *   agent: ["claude-code", "cursor"],
 *   global: true,
 *   json: true,
 * };
 * ```
 */
export interface GlobalOptions {
  /** Target agent IDs (repeatable). */
  agent?: string[];
  /** Operate on global config instead of project. */
  global?: boolean;
  /** Skip confirmation prompts. */
  yes?: boolean;
  /** Target all detected agents. */
  all?: boolean;
  /** Output as JSON. */
  json?: boolean;
  /** Preview changes without writing. */
  dryRun?: boolean;
  /** Enable debug logging. */
  verbose?: boolean;
  /** Suppress non-error output. */
  quiet?: boolean;
}
