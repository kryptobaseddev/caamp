/**
 * CAAMP - Central AI Agent Managed Packages
 *
 * Library exports for programmatic usage.
 */

// Types
export type {
  Provider,
  ProviderPriority,
  ProviderStatus,
  McpServerConfig,
  McpServerEntry,
  ConfigFormat,
  TransportType,
  SourceType,
  ParsedSource,
  SkillMetadata,
  SkillEntry,
  LockEntry,
  CaampLockFile,
  MarketplaceSkill,
  MarketplaceSearchResult,
  AuditRule,
  AuditFinding,
  AuditResult,
  AuditSeverity,
  InjectionStatus,
  InjectionCheckResult,
  GlobalOptions,
} from "./types.js";

// Result types from core modules
export type { DetectionResult } from "./core/registry/detection.js";
export type { InstallResult } from "./core/mcp/installer.js";
export type { SkillInstallResult } from "./core/skills/installer.js";
export type { ValidationResult, ValidationIssue } from "./core/skills/validator.js";

// Registry
export {
  getAllProviders,
  getProvider,
  resolveAlias,
  getProvidersByPriority,
  getProvidersByStatus,
  getProvidersByInstructFile,
  getInstructionFiles,
  getProviderCount,
  getRegistryVersion,
} from "./core/registry/providers.js";

// Detection
export {
  detectProvider,
  detectAllProviders,
  getInstalledProviders,
  detectProjectProviders,
} from "./core/registry/detection.js";

// Source parsing
export { parseSource, isMarketplaceScoped } from "./core/sources/parser.js";

// Skills
export { installSkill, removeSkill, listCanonicalSkills } from "./core/skills/installer.js";
export { discoverSkills, discoverSkill, parseSkillFile } from "./core/skills/discovery.js";
export { validateSkill } from "./core/skills/validator.js";
export { scanFile, scanDirectory, toSarif } from "./core/skills/audit/scanner.js";

// MCP install
export { installMcpServer, installMcpServerToAll, buildServerConfig } from "./core/mcp/installer.js";
export { getTransform } from "./core/mcp/transforms.js";

// MCP read/list/remove
export { resolveConfigPath, listMcpServers, listAllMcpServers, removeMcpServer } from "./core/mcp/reader.js";

// MCP lock
export {
  readLockFile,
  recordMcpInstall,
  removeMcpFromLock,
  getTrackedMcpServers,
  saveLastSelectedAgents,
  getLastSelectedAgents,
} from "./core/mcp/lock.js";

// Skills lock
export {
  recordSkillInstall,
  removeSkillFromLock,
  getTrackedSkills,
  checkSkillUpdate,
} from "./core/skills/lock.js";

// Marketplace
export { MarketplaceClient } from "./core/marketplace/client.js";
export type { MarketplaceResult } from "./core/marketplace/types.js";

// Instructions
export { inject, checkInjection, removeInjection, checkAllInjections, injectAll } from "./core/instructions/injector.js";
export { generateInjectionContent, groupByInstructFile } from "./core/instructions/templates.js";

// Formats
export { readConfig, writeConfig, removeConfig } from "./core/formats/index.js";
export { getNestedValue, deepMerge, ensureDir } from "./core/formats/utils.js";

// Logger
export { setVerbose, setQuiet, isVerbose, isQuiet } from "./core/logger.js";
