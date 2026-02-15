import {
  getAgentsHome,
  getCanonicalSkillsDir,
  getLockFilePath,
  getAgentsMcpDir,
  getAgentsMcpServersPath,
  getAgentsConfigPath,
} from "./standard.js";

/** Global `.agents/` home directory (`~/.agents/` or `$AGENTS_HOME`). */
export const AGENTS_HOME = getAgentsHome();

/** CAAMP lock file path (`~/.agents/.caamp-lock.json`). */
export const LOCK_FILE_PATH = getLockFilePath();

/** Canonical skills directory (`~/.agents/skills/`). */
export const CANONICAL_SKILLS_DIR = getCanonicalSkillsDir();

/** Global MCP directory (`~/.agents/mcp/`). */
export const AGENTS_MCP_DIR = getAgentsMcpDir();

/** Global MCP servers.json path (`~/.agents/mcp/servers.json`). */
export const AGENTS_MCP_SERVERS_PATH = getAgentsMcpServersPath();

/** Global agents config.toml path (`~/.agents/config.toml`). */
export const AGENTS_CONFIG_PATH = getAgentsConfigPath();
