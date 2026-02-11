/**
 * CAAMP - Central AI Agent Managed Packages
 *
 * Library exports for programmatic usage.
 */

// Types
export type {
  Provider,
  McpServerConfig,
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

// MCP
export { installMcpServer, installMcpServerToAll, buildServerConfig } from "./core/mcp/installer.js";
export { getTransform } from "./core/mcp/transforms.js";

// Marketplace
export { MarketplaceClient } from "./core/marketplace/client.js";

// Instructions
export { inject, checkInjection, removeInjection, checkAllInjections, injectAll } from "./core/instructions/injector.js";
export { generateInjectionContent, groupByInstructFile } from "./core/instructions/templates.js";

// Formats
export { readConfig, writeConfig } from "./core/formats/index.js";
