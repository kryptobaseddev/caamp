# Provider Configuration Guide

This guide explains how CAAMP maps provider-specific MCP formats, config keys, and file locations.

## Core Concepts

- CAAMP writes MCP settings to each provider's expected config key.
- CAAMP transforms canonical MCP config for providers with custom schemas.
- Skills are installed once in a canonical location and linked to provider skill directories.

## Common Config Keys

- `mcpServers` - most providers
- `mcp_servers` - Codex
- `extensions` - Goose
- `mcp` - OpenCode
- `servers` - VS Code
- `context_servers` - Zed

## Format Mapping

- JSON: most providers
- JSONC: Zed
- YAML: Goose, SWE-Agent
- TOML: Codex

## Scope Behavior

- Project scope writes to provider project config path.
- Global scope writes to provider home/global config path.
- Some providers support only one scope.

## Skills Model

- Canonical path: `getCanonicalSkillsDir()/\<name\>` (default `~/.agents/skills/<name>/`, override via `AGENTS_HOME`)
- Provider installs use symlinks (or fallback copy on Windows).
- Install records are tracked in `getLockFilePath()` (default `~/.agents/.caamp-lock.json`).

## Per-Provider Details

Use `caamp providers show <id>` for exact paths, key names, and transport capabilities.

Examples:

```bash
caamp providers show claude-code
caamp providers show codex
caamp providers show zed
```

## Validation

Run the built-in diagnostics after configuration changes:

```bash
caamp doctor
```
