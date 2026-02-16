import { homedir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildSkillSubPathCandidates,
  getAgentsConfigPath,
  getAgentsHome,
  getAgentsInstructFile,
  getAgentsLinksDir,
  getAgentsMcpDir,
  getAgentsMcpServersPath,
  getAgentsSpecDir,
  getAgentsWikiDir,
  getCanonicalSkillsDir,
  getLockFilePath,
  normalizeSkillSubPath,
  resolveProviderConfigPath,
  resolveProviderSkillsDir,
  resolveRegistryTemplatePath,
} from "../../src/core/paths/standard.js";
import type { Provider } from "../../src/types.js";

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

  describe("normalizeHomeOverride (via getAgentsHome)", () => {
    it("resolves exact '~' to homedir", () => {
      process.env["AGENTS_HOME"] = "~";
      expect(getAgentsHome()).toBe(homedir());
    });

    it("resolves '~/...' to homedir-prefixed path", () => {
      process.env["AGENTS_HOME"] = "~/my-agents";
      expect(getAgentsHome()).toBe(`${homedir()}/my-agents`);
    });

    it("resolves absolute path as-is", () => {
      process.env["AGENTS_HOME"] = "/custom/path";
      expect(getAgentsHome()).toBe("/custom/path");
    });

    it("resolves relative path against homedir", () => {
      process.env["AGENTS_HOME"] = "relative-agents";
      const result = getAgentsHome();
      expect(result).toContain("relative-agents");
      // Relative paths are resolved via resolve(homedir(), value)
      expect(result).not.toBe("relative-agents");
    });
  });

  describe("getAgentsHome default behavior", () => {
    it("returns ~/.agents when AGENTS_HOME is unset", () => {
      delete process.env["AGENTS_HOME"];
      const result = getAgentsHome();
      expect(result).toBe(`${homedir()}/.agents`);
      expect(result).toContain(".agents");
    });

    it("returns ~/.agents when AGENTS_HOME is empty string", () => {
      process.env["AGENTS_HOME"] = "";
      const result = getAgentsHome();
      expect(result).toBe(`${homedir()}/.agents`);
    });

    it("returns ~/.agents when AGENTS_HOME is whitespace only", () => {
      process.env["AGENTS_HOME"] = "   ";
      const result = getAgentsHome();
      expect(result).toBe(`${homedir()}/.agents`);
    });
  });

  describe("resolveProviderSkillsDir", () => {
    const mockProvider = {
      pathSkills: "/home/user/.claude/skills",
      pathProjectSkills: ".claude/skills",
    } as Provider;

    it("returns global skills dir from provider", () => {
      const result = resolveProviderSkillsDir(mockProvider, "global");
      expect(result).toBe("/home/user/.claude/skills");
    });

    it("returns project-scoped skills dir under project root", () => {
      const result = resolveProviderSkillsDir(mockProvider, "project", "/proj");
      expect(result).toBe("/proj/.claude/skills");
    });
  });

  describe("resolveProviderConfigPath", () => {
    it("returns global config path from provider", () => {
      const mockProvider = {
        configPathGlobal: "/home/user/.claude/config.json",
        configPathProject: ".claude/config.json",
      } as Provider;
      const result = resolveProviderConfigPath(mockProvider, "global");
      expect(result).toBe("/home/user/.claude/config.json");
    });

    it("returns project config path resolved under project root", () => {
      const mockProvider = {
        configPathGlobal: "/home/user/.claude/config.json",
        configPathProject: ".claude/config.json",
      } as Provider;
      const result = resolveProviderConfigPath(mockProvider, "project", "/proj");
      expect(result).toBe("/proj/.claude/config.json");
    });

    it("returns null for project scope when provider has no project config", () => {
      const mockProvider = {
        configPathGlobal: "/home/user/.windsurf/config.json",
        configPathProject: null,
      } as Provider;
      const result = resolveProviderConfigPath(mockProvider, "project", "/proj");
      expect(result).toBeNull();
    });
  });

  describe("buildSkillSubPathCandidates", () => {
    it("expands skills/ path with .agents/ and .claude/ prefixes", () => {
      const candidates = buildSkillSubPathCandidates("skills/my-skill", undefined);
      expect(candidates).toContain("skills/my-skill");
      expect(candidates).toContain(".agents/skills/my-skill");
      expect(candidates).toContain(".claude/skills/my-skill");
    });

    it("does not expand paths that do not start with skills/", () => {
      const candidates = buildSkillSubPathCandidates("custom/path", undefined);
      expect(candidates).toContain("custom/path");
      expect(candidates).not.toContain(".agents/custom/path");
      expect(candidates).not.toContain(".claude/custom/path");
    });

    it("includes both marketplace and parsed paths", () => {
      const candidates = buildSkillSubPathCandidates("skills/alpha", "skills/beta");
      expect(candidates).toContain("skills/alpha");
      expect(candidates).toContain("skills/beta");
      expect(candidates).toContain(".agents/skills/alpha");
      expect(candidates).toContain(".claude/skills/alpha");
      expect(candidates).toContain(".agents/skills/beta");
      expect(candidates).toContain(".claude/skills/beta");
    });

    it("deduplicates identical candidates", () => {
      const candidates = buildSkillSubPathCandidates("skills/same", "skills/same");
      const unique = new Set(candidates);
      expect(candidates.length).toBe(unique.size);
    });

    it("returns [undefined] when both inputs are undefined", () => {
      const candidates = buildSkillSubPathCandidates(undefined, undefined);
      expect(candidates).toEqual([undefined]);
    });

    it("strips SKILL.md suffix via normalizeSkillSubPath", () => {
      const candidates = buildSkillSubPathCandidates("skills/my-skill/SKILL.md", undefined);
      expect(candidates).toContain("skills/my-skill");
      expect(candidates).not.toContain("skills/my-skill/SKILL.md");
    });
  });

  describe("normalizeSkillSubPath", () => {
    it("returns undefined for empty string", () => {
      expect(normalizeSkillSubPath("")).toBeUndefined();
    });

    it("returns undefined for undefined", () => {
      expect(normalizeSkillSubPath(undefined)).toBeUndefined();
    });

    it("strips leading slashes", () => {
      expect(normalizeSkillSubPath("///skills/foo")).toBe("skills/foo");
    });

    it("strips trailing /SKILL.md", () => {
      expect(normalizeSkillSubPath("skills/foo/SKILL.md")).toBe("skills/foo");
    });

    it("normalizes backslashes to forward slashes", () => {
      expect(normalizeSkillSubPath("skills\\foo\\bar")).toBe("skills/foo/bar");
    });
  });
});
