import { afterEach, describe, expect, it } from "vitest";
import {
  getAgentsHome,
  getCanonicalSkillsDir,
  getLockFilePath,
  resolveRegistryTemplatePath,
  getAgentsMcpDir,
  getAgentsMcpServersPath,
  getAgentsInstructFile,
  getAgentsConfigPath,
  getAgentsWikiDir,
  getAgentsSpecDir,
  getAgentsLinksDir,
} from "../../src/core/paths/standard.js";

const originalAgentsHome = process.env["AGENTS_HOME"];

describe("paths standard", () => {
  afterEach(() => {
    if (originalAgentsHome === undefined) {
      delete process.env["AGENTS_HOME"];
    } else {
      process.env["AGENTS_HOME"] = originalAgentsHome;
    }
  });

  it("respects AGENTS_HOME override for canonical paths", () => {
    process.env["AGENTS_HOME"] = "~/custom-agents";

    expect(getAgentsHome()).toContain("custom-agents");
    expect(getCanonicalSkillsDir()).toContain("custom-agents");
    expect(getLockFilePath()).toContain("custom-agents");
  });

  it("resolves registry template variables", () => {
    process.env["AGENTS_HOME"] = "~/agents-override";
    const resolved = resolveRegistryTemplatePath("$AGENTS_HOME/skills");
    expect(resolved).toContain("agents-override");
    expect(resolved).not.toContain("$AGENTS_HOME");
  });

  describe(".agents/ standard paths", () => {
    it("returns global MCP dir under AGENTS_HOME", () => {
      process.env["AGENTS_HOME"] = "/test/agents";
      expect(getAgentsMcpDir("global")).toBe("/test/agents/mcp");
    });

    it("returns project MCP dir under project root", () => {
      expect(getAgentsMcpDir("project", "/my/project")).toBe("/my/project/.agents/mcp");
    });

    it("returns global servers.json path", () => {
      process.env["AGENTS_HOME"] = "/test/agents";
      expect(getAgentsMcpServersPath("global")).toBe("/test/agents/mcp/servers.json");
    });

    it("returns project servers.json path", () => {
      expect(getAgentsMcpServersPath("project", "/my/project")).toBe("/my/project/.agents/mcp/servers.json");
    });

    it("returns global AGENTS.md path", () => {
      process.env["AGENTS_HOME"] = "/test/agents";
      expect(getAgentsInstructFile("global")).toBe("/test/agents/AGENTS.md");
    });

    it("returns project AGENTS.md path", () => {
      expect(getAgentsInstructFile("project", "/my/project")).toBe("/my/project/.agents/AGENTS.md");
    });

    it("returns global config.toml path", () => {
      process.env["AGENTS_HOME"] = "/test/agents";
      expect(getAgentsConfigPath("global")).toBe("/test/agents/config.toml");
    });

    it("returns standard directory paths", () => {
      process.env["AGENTS_HOME"] = "/test/agents";
      expect(getAgentsWikiDir("global")).toBe("/test/agents/wiki");
      expect(getAgentsSpecDir("global")).toBe("/test/agents/spec");
      expect(getAgentsLinksDir("global")).toBe("/test/agents/links");
    });

    it("returns project-scoped directory paths", () => {
      expect(getAgentsWikiDir("project", "/proj")).toBe("/proj/.agents/wiki");
      expect(getAgentsSpecDir("project", "/proj")).toBe("/proj/.agents/spec");
      expect(getAgentsLinksDir("project", "/proj")).toBe("/proj/.agents/links");
    });
  });
});
