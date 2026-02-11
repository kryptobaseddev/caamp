# CAAMP - Central AI Agent Managed Packages

Unified provider registry and package manager for AI coding agents. One CLI to manage Skills, MCP servers, and instruction files across 28+ AI coding tools.

## Install

```bash
npx caamp <command>
```

## Commands

### Providers

```bash
caamp providers list               # List all 28+ supported providers
caamp providers detect             # Auto-detect installed providers
caamp providers show <id>          # Show provider details
```

### Skills

```bash
caamp skills install <source>      # Install from GitHub/marketplace
caamp skills remove [name]         # Remove skill(s)
caamp skills list [-g]             # List installed skills
caamp skills find [query]          # Search marketplace
caamp skills init [name]           # Create new skill template
caamp skills validate [path]       # Validate SKILL.md
caamp skills audit [path]          # Security scan (46+ rules, SARIF)
caamp skills check                 # Check for updates
```

### MCP Servers

```bash
caamp mcp install <source>         # Install MCP server to agent configs
caamp mcp remove <name>            # Remove MCP server
caamp mcp list                     # List configured servers
caamp mcp detect                   # Auto-detect MCP configs
```

### Instructions

```bash
caamp instructions inject          # Inject blocks into instruction files
caamp instructions check           # Check injection status
caamp instructions update          # Update all injections
```

### Config

```bash
caamp config show <provider>       # Show provider config
caamp config path <provider>       # Show config file path
```

## Global Flags

```
-a, --agent <name>    Target specific agent(s), repeatable
-g, --global          Use global scope (default: project)
-y, --yes             Skip confirmation prompts
--all                 Target all detected agents
--json                JSON output
--dry-run             Preview without writing
```

## Supported Providers

| Priority | Providers |
|----------|-----------|
| High | Claude Code, Cursor, Windsurf |
| Medium | Codex, Gemini CLI, GitHub Copilot, OpenCode, Cline, Kimi, VS Code, Zed, Claude Desktop |
| Low | Roo, Continue, Goose, Antigravity, Kiro, Amp, Trae, Aide, Pear AI, Void AI, Cody, Kilo Code, Qwen Code, OpenHands, CodeBuddy, CodeStory |

## Instruction File Mapping

- `CLAUDE.md` - Claude Code only
- `GEMINI.md` - Gemini CLI only
- `AGENTS.md` - All other providers (Cursor, Windsurf, Codex, Kimi, etc.)

## License

MIT
