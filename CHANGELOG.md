# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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
