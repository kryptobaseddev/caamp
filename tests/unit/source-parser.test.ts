import { describe, it, expect } from "vitest";
import { parseSource, isMarketplaceScoped } from "../../src/core/sources/parser.js";

describe("Source Parser", () => {
  describe("parseSource", () => {
    it("parses GitHub URLs", () => {
      const result = parseSource("https://github.com/owner/repo");
      expect(result.type).toBe("github");
      expect(result.owner).toBe("owner");
      expect(result.repo).toBe("repo");
      expect(result.inferredName).toBe("repo");
    });

    it("parses GitHub URLs with tree path", () => {
      const result = parseSource("https://github.com/owner/repo/tree/main/skills/my-skill");
      expect(result.type).toBe("github");
      expect(result.owner).toBe("owner");
      expect(result.repo).toBe("repo");
      expect(result.ref).toBe("main");
      expect(result.path).toBe("skills/my-skill");
    });

    it("parses GitHub shorthand", () => {
      const result = parseSource("owner/repo");
      expect(result.type).toBe("github");
      expect(result.owner).toBe("owner");
      expect(result.repo).toBe("repo");
    });

    it("parses GitLab URLs", () => {
      const result = parseSource("https://gitlab.com/owner/repo");
      expect(result.type).toBe("gitlab");
      expect(result.owner).toBe("owner");
      expect(result.repo).toBe("repo");
    });

    it("parses remote HTTP URLs as remote type", () => {
      const result = parseSource("https://mcp.neon.tech/sse");
      expect(result.type).toBe("remote");
      expect(result.value).toBe("https://mcp.neon.tech/sse");
    });

    it("infers name from remote URL", () => {
      expect(parseSource("https://mcp.neon.tech/sse").inferredName).toBe("neon");
    });

    it("parses scoped npm packages", () => {
      const result = parseSource("@modelcontextprotocol/server-postgres");
      expect(result.type).toBe("package");
      expect(result.value).toBe("@modelcontextprotocol/server-postgres");
      expect(result.inferredName).toBe("postgres");
    });

    it("strips MCP prefixes from package names", () => {
      expect(parseSource("mcp-server-fetch").inferredName).toBe("fetch");
      expect(parseSource("server-postgres").inferredName).toBe("postgres");
    });

    it("parses simple npm package names", () => {
      const result = parseSource("some-package");
      expect(result.type).toBe("package");
      expect(result.value).toBe("some-package");
    });

    it("parses local paths", () => {
      expect(parseSource("./my-skill").type).toBe("local");
      expect(parseSource("../skills").type).toBe("local");
      expect(parseSource("/absolute/path").type).toBe("local");
      expect(parseSource("~/skills").type).toBe("local");
    });

    it("infers basename from local paths (not full path)", () => {
      expect(parseSource("./my-skill").inferredName).toBe("my-skill");
      expect(parseSource("../skills/ct-research").inferredName).toBe("ct-research");
      expect(parseSource("/home/user/skills/my-skill").inferredName).toBe("my-skill");
      expect(parseSource("~/skills/another-skill").inferredName).toBe("another-skill");
    });

    it("handles trailing slashes in local paths", () => {
      expect(parseSource("./my-skill/").inferredName).toBe("my-skill");
      expect(parseSource("/path/to/skill//").inferredName).toBe("skill");
    });

    it("treats multi-word strings as commands", () => {
      const result = parseSource("npx -y @modelcontextprotocol/server-postgres");
      expect(result.type).toBe("command");
    });
  });

  describe("isMarketplaceScoped", () => {
    it("recognizes scoped names", () => {
      expect(isMarketplaceScoped("@author/skill")).toBe(true);
      expect(isMarketplaceScoped("@facebook/verify")).toBe(true);
    });

    it("rejects non-scoped names", () => {
      expect(isMarketplaceScoped("skill-name")).toBe(false);
      expect(isMarketplaceScoped("owner/repo")).toBe(false);
      expect(isMarketplaceScoped("https://example.com")).toBe(false);
    });
  });
});
