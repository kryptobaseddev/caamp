<p align="center">
  <img src="public/banner.png" alt="CAAMP - Central AI Agent Managed Packages" width="100%" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@cleocode/caamp"><img src="https://img.shields.io/npm/v/@cleocode/caamp?color=blue" alt="npm version" /></a>
  <a href="https://github.com/kryptobaseddev/caamp/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@cleocode/caamp" alt="license" /></a>
  <img src="https://img.shields.io/node/v/@cleocode/caamp" alt="node version" />
  <img src="https://img.shields.io/badge/providers-28%2B-green" alt="providers" />
  <img src="https://img.shields.io/badge/TypeScript-strict-blue" alt="typescript" />
</p>

# CAAMP - Central AI Agent Managed Packages

**One CLI to manage Skills, MCP servers, and instruction files across 28+ AI coding agents.**

CAAMP is a unified provider registry and package manager for AI coding agents. It replaces the need to manually configure each agent's MCP servers, skills, and instruction files individually -- handling the differences in config formats (JSON, JSONC, YAML, TOML), config keys (`mcpServers`, `mcp_servers`, `extensions`, `mcp`, `servers`, `context_servers`), and file paths across all supported providers.

## Install

```bash
# Global install (recommended)
npm install -g @cleocode/caamp

# Or run directly with npx
npx @cleocode/caamp <command>
```

After global install, use `caamp` directly:

```bash
caamp providers list
caamp providers detect
caamp mcp install @anthropic/mcp-server-fetch
caamp skills install owner/repo
```

## Library Usage

CAAMP also exports a full programmatic API:

```bash
npm install @cleocode/caamp
```

```typescript
import {
  getAllProviders,
  getInstalledProviders,
  listAllMcpServers,
  installSkill,
  detectAllProviders,
} from "@cleocode/caamp";

// Get all 28+ registered providers
const providers = getAllProviders();

// Detect which agents are installed on this system
const installed = getInstalledProviders();

// List MCP servers across all installed providers
const servers = await listAllMcpServers(installed, "global");
```

See [API Reference](docs/API-REFERENCE.md) for full documentation of all 82 exported symbols.

## CLI Commands

### Providers

```bash
caamp providers list               # List all 28+ supported providers
caamp providers list --tier high   # Filter by priority tier
caamp providers detect             # Auto-detect installed providers
caamp providers detect --project   # Detect project-level configs
caamp providers show <id>          # Show provider details + all paths
```

### Skills

```bash
caamp skills install <source>      # Install from GitHub/URL/marketplace
caamp skills remove [name]         # Remove skill(s) + symlinks
caamp skills list [-g]             # List installed skills
caamp skills find [query]          # Search marketplace (agentskills.in + skills.sh)
caamp skills init [name]           # Create new SKILL.md template
caamp skills validate [path]       # Validate SKILL.md format
caamp skills audit [path]          # Security scan (46+ rules, SARIF output)
caamp skills check                 # Check for available updates
caamp skills update                # Update all outdated skills
```

### MCP Servers

```bash
caamp mcp install <source>         # Install MCP server to agent configs
caamp mcp remove <name>            # Remove MCP server from configs
caamp mcp list                     # List configured MCP servers
caamp mcp list -a cursor           # List for a specific agent
caamp mcp detect                   # Auto-detect MCP configurations
```

### Instructions

```bash
caamp instructions inject          # Inject blocks into instruction files
caamp instructions check           # Check injection status across providers
caamp instructions update          # Update all instruction file injections
```

### Config

```bash
caamp config show <provider>       # Show provider config contents
caamp config path <provider>       # Show config file path
```

## Global Flags

| Flag | Description |
|------|-------------|
| `-a, --agent <name>` | Target specific agent(s), repeatable |
| `-g, --global` | Use global/user scope (default: project) |
| `-y, --yes` | Skip confirmation prompts |
| `--all` | Target all detected agents |
| `--json` | JSON output format |
| `--dry-run` | Preview changes without writing |

## Supported Providers

CAAMP supports **46 AI coding agents** across 3 priority tiers:

| Priority | Providers |
|----------|-----------|
| **High** | Claude Code, Cursor, Windsurf |
| **Medium** | Codex CLI, Gemini CLI, GitHub Copilot, OpenCode, Cline, Kimi, VS Code, Zed, Claude Desktop |
| **Low** | Roo, Continue, Goose, Antigravity, Kiro, Amp, Trae, Aide, Pear AI, Void AI, Cody, Kilo Code, Qwen Code, OpenHands, CodeBuddy, CodeStory, Aider, Amazon Q Developer, Tabnine, Augment, JetBrains AI, Devin, Replit Agent, Mentat, Sourcery, Blackbox AI, Double, Codegen, Sweep, Supermaven, Copilot CLI, SWE-Agent, Forge, Gemini Code Assist |

### Config Key Mapping

Each provider uses a different key name for MCP server configuration:

| Config Key | Providers |
|------------|-----------|
| `mcpServers` | Claude Code, Cursor, Windsurf, Gemini CLI, GitHub Copilot, Cline, Kimi, and 12 others |
| `mcp_servers` | Codex |
| `extensions` | Goose |
| `mcp` | OpenCode |
| `servers` | VS Code |
| `context_servers` | Zed |

### Instruction File Mapping

| File | Providers |
|------|-----------|
| `CLAUDE.md` | Claude Code, Claude Desktop |
| `GEMINI.md` | Gemini CLI |
| `AGENTS.md` | All other providers (Cursor, Windsurf, Codex, Kimi, etc.) |

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   CLI Layer                      │
│  providers │ skills │ mcp │ instructions │ config│
├─────────────────────────────────────────────────┤
│                 Core Layer                       │
│  registry │ formats │ skills │ mcp │             │
│  marketplace │ sources │ instructions            │
├─────────────────────────────────────────────────┤
│                Data Layer                        │
│  providers/registry.json │ lock files │ configs  │
└─────────────────────────────────────────────────┘
```

- **Provider Registry**: Single `providers/registry.json` with all 28 provider definitions
- **Format Handlers**: JSON, JSONC (comment-preserving), YAML, TOML
- **Skills Model**: Canonical copy + symlinks (install once, link to all agents)
- **MCP Transforms**: Per-agent config shape transforms for Goose, Zed, OpenCode, Codex, Cursor
- **Lock File**: Tracks all installations at `~/.agents/.caamp-lock.json`

## Documentation

| Document | Description |
|----------|-------------|
| [API Reference](docs/API-REFERENCE.md) | Full library API (82 exports with signatures and examples) |
| [Vision & Architecture](claudedocs/VISION.md) | Project vision, design philosophy, and architecture |
| [Product Requirements](claudedocs/PRD.md) | Full PRD with user stories and feature requirements |
| [Technical Specification](claudedocs/specs/CAAMP-SPEC.md) | RFC 2119 spec covering all subsystems |
| [Gap Analysis & Roadmap](claudedocs/GAP-ANALYSIS.md) | Current state vs plan, v0.2.0+ roadmap |

## Contributing

Provider definitions live in `providers/registry.json`. To add a new AI coding agent:

1. Add a provider entry to `providers/registry.json` with all required fields
2. Run `npm test` to validate the registry
3. Submit a PR

See the [Technical Specification](claudedocs/specs/CAAMP-SPEC.md#3-provider-registry-specification) for the full provider schema.

## License

MIT
