# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.5.1] - 2026-02-12

### Other Changes
- Skills Lock File Bugs & Naming Fix (T119)
- Fix scopedName using raw CLI input in skills install (T120)
- Fix isGlobal defaulting to false for catalog installs (T121)
- Fix lock file re-install overwriting metadata instead of merging (T122)
- Rename contribution-protocol to ct-contribution in canonical install (T123)
- Add skills health check to doctor command (T124)


## [0.5.0] - 2026-02-12

### Added

- `@cleocode/ct-skills@2.0.0` as dependency — official skills catalog library for skill discovery, metadata, dependency resolution, and install profiles
- ESM adapter (`src/core/skills/catalog.ts`) wrapping ct-skills CJS module via `createRequire()` with full TypeScript types
- `--profile <name>` option on `skills install` for batch-installing ct-skills profiles (minimal, core, recommended, full)
- Package source type support: `caamp skills install <skill-name>` resolves from ct-skills catalog
- `.agents/mcp/servers.json` as primary MCP config source, checked before per-provider legacy configs (per `.agents/` standard Section 9.4)
- `.agents/` standard path helpers: `getAgentsMcpDir()`, `getAgentsMcpServersPath()`, `getAgentsInstructFile()`, `getAgentsConfigPath()`, `getAgentsWikiDir()`, `getAgentsSpecDir()`, `getAgentsLinksDir()` — all support global/project scopes with cross-platform resolution
- `AGENTS_MCP_DIR`, `AGENTS_MCP_SERVERS_PATH`, `AGENTS_CONFIG_PATH` exports from paths module
- `listAgentsMcpServers()` function in MCP reader for `.agents/mcp/servers.json`
- `CtSkillEntry`, `CtValidationResult`, `CtProfileDefinition`, `CtDispatchMatrix`, `CtManifest`, `CtManifestSkill` types
- `catalog` namespace export from library barrel
- 22 new tests: catalog adapter (11), `.agents/` paths (9), local path inference (2)
- CI workflows: CodeQL security scanning, API docs generation, Dependabot config
- Biome linter configuration
- CONTRIBUTING.md, SECURITY.md, LAFS compliance docs, v1 migration guide

### Fixed

- **Skills installer naming bug**: local path installs now read `SKILL.md` `name` field as authoritative skill name instead of using the full path string (which created nested directories like `~/.agents/skills/./path/to/my-skill/`)
- `inferName()` in source parser now extracts directory basename for local paths instead of returning the entire path
- Removed stale providers from registry (sweep, supermaven) that no longer have active agent products

### Changed

- `skills install` source argument is now optional (required unless `--profile` is provided)
- `listAllMcpServers()` now checks `.agents/mcp/servers.json` first before per-provider configs
- Expanded library export count with catalog, path, and MCP reader additions

## [0.3.0] - 2026-02-11

### Added

- `caamp doctor` command with 6 diagnostic categories: environment, registry, installed providers, skills symlinks, lock file, config files (T034)
- `--verbose` / `-v` global flag for debug output across all commands (T035)
- `--quiet` / `-q` global flag to suppress non-error output for scripting (T035)
- Shared logger utility (`src/core/logger.ts`) with `setVerbose`, `setQuiet`, `isVerbose`, `isQuiet` exports (T035)
- TSDoc/JSDoc annotations on all 89 public API exports across 19 source files (T031)
- TypeDoc configuration for automated API reference generation via `npm run docs:api` (T032)
- `docs:api:check` CI validation step to ensure TSDoc stays valid (T032)
- API audit report documenting all 89 exports against source code (T030)
- `MarketplaceResult` type export for accurate `MarketplaceClient` return types (T037)
- `ProviderPriority` and `ProviderStatus` union type exports (T037)
- Debug logging in detection, MCP installer, MCP reader, and format handlers (T035)

### Changed

- Library export count from 82 to 89 (added logger, MarketplaceResult, ProviderPriority, ProviderStatus) (T037)
- Deduplicated lock file I/O into shared `src/core/lock-utils.ts` module (T033)
- API-REFERENCE.md updated with accurate return types and new export documentation (T037)
- GAP-ANALYSIS.md updated with v0.3.0 results and current file inventory (T036)
- CI workflow now includes TypeDoc validation step (T032)

### Fixed

- `providers detect` now uses `where` on Windows instead of Unix-only `which` (T033)
- `skills install` sourceType was hardcoded to `"github"` -- now uses `parsed.type` from source parser (T033)
- `checkSkillUpdate()` API docs incorrectly stated "not yet implemented" -- function performs actual network SHA comparison since v0.2.0 (T037)
- `MarketplaceClient.search()` and `getSkill()` docs referenced wrong return type (`MarketplaceSkill` instead of `MarketplaceResult`) (T037)

## [0.2.0] - 2026-02-11

### Added

- Expanded provider registry from 28 to 46 AI coding agent providers (T028)
  - New: Aider, Amazon Q Developer, Tabnine, Augment, Blackbox AI, Devin, Replit Agent, Mentat, Sourcery, Double, Codegen, JetBrains AI, Sweep, Supermaven, Copilot CLI, SWE-Agent, Forge, Gemini Code Assist
- Network-based version checking for `skills check` command (T026)
- Full `skills update` implementation with SHA comparison and reinstall (T025)
- 46 new unit tests for marketplace and instructions modules (T027)
  - 25 tests for instructions (injector + templates)
  - 21 tests for marketplace (client + adapters)
  - Total test count: 74 → 120
- README rewrite with banner image, badges, proper install instructions, library usage, architecture diagram, and documentation links (T022)
- API Reference document covering all 82 exported symbols (docs/API-REFERENCE.md)
- Product Requirements Document (claudedocs/PRD.md)
- Technical Specification with RFC 2119 language (claudedocs/specs/CAAMP-SPEC.md)
- Vision & Architecture document (claudedocs/VISION.md)
- Gap Analysis & Roadmap (claudedocs/GAP-ANALYSIS.md)
- Research Brief (claudedocs/agent-outputs/research-brief.md)

### Changed

- Bumped Node.js engine requirement from >=18 to >=20 (T023)
- Updated commander from ^13 to ^14 (T023)
- Updated @clack/prompts from ^0.10 to ^1.0 (T023)
- Updated tsup build target from node18 to node20 (T023)
- Fixed `npx caamp` to `npx @cleocode/caamp` in all documentation (T024)

### Fixed

- `skills update` command was a non-functional stub - now implements actual version comparison (T025)
- `skills check` command had no network checking - now uses git ls-remote for SHA comparison (T026)



## [0.1.0] - 2026-02-11

### Added

- Unified provider registry with 28 AI coding agent definitions (T002)
- Provider auto-detection engine supporting binary, directory, appBundle, and flatpak methods (T003)
- Config format handlers for JSON/JSONC (with comment preservation), YAML, and TOML (T004)
- MCP server config installer with provider-specific format transforms (T005)
- Lock file management for tracking MCP servers and skills at ~/.agents/.caamp-lock.json (T006)
- Skills installer (canonical + symlink model), discovery, validator, and audit scanner with SARIF output (T007)
- Source parser for GitHub, npm, URL, local, and command sources (T008)
- Instructions injection system for agent config files with CLEO-style marker blocks (T009)
- Marketplace client for skill discovery and search (T010)
- Full CLI with commander.js: providers, mcp, skills, instructions, and marketplace commands (T011)
- Library API: src/core/mcp/reader.ts with resolveConfigPath, listMcpServers, listAllMcpServers, removeMcpServer (T012)
- Format router: removeConfig() paralleling readConfig/writeConfig (T013)
- McpServerEntry type for typed MCP list results (T014)
- 57 library exports from src/index.ts for programmatic usage (T016)
- Published as @cleocode/caamp on npm (T020)
- GitHub repository at https://github.com/kryptobaseddev/caamp (T019)

### Changed

- Refactored mcp list/remove/detect CLI commands to delegate to core reader module (T015)
- Moved resolveConfigPath from installer.ts to reader.ts as single source of truth (T017)
- Updated package name from caamp to @cleocode/caamp with public publishConfig (T018)
