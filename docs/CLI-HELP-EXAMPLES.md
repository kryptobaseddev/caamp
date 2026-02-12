# CLI Help Examples

Use `--help` on any command to inspect flags and usage.

## Top-level

```bash
caamp --help
```

## Providers

```bash
caamp providers --help
caamp providers list --help
caamp providers detect --help
caamp providers show --help
```

## Skills

```bash
caamp skills --help
caamp skills install --help
caamp skills remove --help
caamp skills list --help
caamp skills find --help
caamp skills check --help
caamp skills update --help
caamp skills init --help
caamp skills validate --help
caamp skills audit --help
```

### Skills recommendation flow

Human mode (ranked list + CHOOSE line):

```bash
caamp skills find "docs quality" --recommend --top 3 --must-have docs --prefer markdown
# ...
# [1] @owner/skill-a ...
# [2] @owner/skill-b ...
# [3] @owner/skill-c ...
# CHOOSE: 1,2,3
```

JSON mode (LAFS envelope + recommendation payload):

```bash
caamp skills find "docs quality" --recommend --json --top 3 --details
```

Criteria flags:

```bash
--must-have <term>   # repeatable and comma-delimited
--prefer <term>      # repeatable and comma-delimited
--exclude <term>     # repeatable and comma-delimited
--select <index>     # selects ranked item by 1-based index
--details            # expanded score evidence in JSON
```

Canonical LAFS spec: https://github.com/kryptobaseddev/lafs-protocol/blob/main/lafs.md

## MCP

```bash
caamp mcp --help
caamp mcp install --help
caamp mcp remove --help
caamp mcp list --help
caamp mcp detect --help
```

## Instructions

```bash
caamp instructions --help
caamp instructions inject --help
caamp instructions check --help
caamp instructions update --help
```

## Config and Doctor

```bash
caamp config --help
caamp config show --help
caamp config path --help
caamp doctor --help
```

## Advanced

```bash
caamp advanced --help
caamp advanced providers --help
caamp advanced batch --help
caamp advanced conflicts --help
caamp advanced apply --help
caamp advanced instructions --help
caamp advanced configure --help
```
