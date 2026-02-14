import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Provider } from "../../src/types.js";

const mocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  cp: vi.fn(),
  rm: vi.fn(),
  symlink: vi.fn(),
  readdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  readlink: vi.fn(),
  existsSync: vi.fn(),
  lstatSync: vi.fn(),
  resolveProviderSkillsDir: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  mkdir: mocks.mkdir,
  cp: mocks.cp,
  rm: mocks.rm,
  symlink: mocks.symlink,
  readdir: mocks.readdir,
  readFile: mocks.readFile,
  writeFile: mocks.writeFile,
  readlink: mocks.readlink,
}));

vi.mock("node:fs", () => ({
  existsSync: mocks.existsSync,
  lstatSync: mocks.lstatSync,
}));

vi.mock("../../src/core/paths/agents.js", () => ({
  CANONICAL_SKILLS_DIR: "/mock/canonical/skills",
}));

vi.mock("../../src/core/paths/standard.js", () => ({
  resolveProviderSkillsDir: mocks.resolveProviderSkillsDir,
}));

import { installSkill, listCanonicalSkills, removeSkill } from "../../src/core/skills/installer.js";

function provider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: "claude-code",
    toolName: "Claude Code",
    vendor: "Anthropic",
    agentFlag: "claude",
    aliases: [],
    pathGlobal: "",
    pathProject: "",
    instructFile: "CLAUDE.md",
    configKey: "mcpServers",
    configFormat: "json",
    configPathGlobal: "/tmp/global.json",
    configPathProject: ".claude/settings.json",
    pathSkills: "",
    pathProjectSkills: "",
    detection: { methods: [] },
    supportedTransports: ["stdio", "sse", "http"],
    supportsHeaders: true,
    priority: "high",
    status: "active",
    agentSkillsCompatible: true,
    ...overrides,
  };
}

describe("skills installer", () => {
  beforeEach(() => {
    mocks.mkdir.mockReset();
    mocks.cp.mockReset();
    mocks.rm.mockReset();
    mocks.symlink.mockReset();
    mocks.readdir.mockReset();
    mocks.existsSync.mockReset();
    mocks.lstatSync.mockReset();
    mocks.resolveProviderSkillsDir.mockReset();

    mocks.existsSync.mockReturnValue(false);
  });

  it("aggregates install success and provider-level errors", async () => {
    const primary = provider({ id: "primary" });
    const missing = provider({ id: "missing-dir" });
    const broken = provider({ id: "broken" });

    mocks.resolveProviderSkillsDir.mockImplementation((p: Provider) => {
      if (p.id === "primary") return "/mock/providers/primary/skills";
      if (p.id === "missing-dir") return null;
      if (p.id === "broken") return "/mock/providers/broken/skills";
      return null;
    });

    mocks.mkdir.mockImplementation((path: string) => {
      if (path === "/mock/providers/broken/skills") {
        throw new Error("permission denied");
      }
    });

    const result = await installSkill("/tmp/source", "skill-a", [primary, missing, broken], true);

    expect(result).toEqual({
      name: "skill-a",
      canonicalPath: "/mock/canonical/skills/skill-a",
      linkedAgents: ["primary"],
      errors: [
        "missing-dir: Provider missing-dir has no skills directory",
        "broken: permission denied",
      ],
      success: true,
    });

    expect(mocks.cp).toHaveBeenCalledWith("/tmp/source", "/mock/canonical/skills/skill-a", { recursive: true });
    expect(mocks.symlink).toHaveBeenCalledWith(
      "/mock/canonical/skills/skill-a",
      "/mock/providers/primary/skills/skill-a",
      "dir",
    );
  });

  it("falls back to copy when symlink creation fails", async () => {
    const p = provider({ id: "copy-only" });

    mocks.resolveProviderSkillsDir.mockReturnValue("/mock/providers/copy-only/skills");
    mocks.symlink.mockRejectedValue(new Error("symlink disabled"));

    const result = await installSkill("/tmp/source", "skill-b", [p], false, "/repo");

    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(mocks.cp).toHaveBeenNthCalledWith(1, "/tmp/source", "/mock/canonical/skills/skill-b", { recursive: true });
    expect(mocks.cp).toHaveBeenNthCalledWith(
      2,
      "/mock/canonical/skills/skill-b",
      "/mock/providers/copy-only/skills/skill-b",
      { recursive: true },
    );
    expect(mocks.resolveProviderSkillsDir).toHaveBeenCalledWith(p, "project", "/repo");
  });

  it("removes links from providers and canonical copy", async () => {
    const alpha = provider({ id: "alpha" });
    const beta = provider({ id: "beta" });

    mocks.resolveProviderSkillsDir.mockImplementation((p: Provider) => (
      p.id === "alpha" ? "/mock/providers/alpha/skills" : "/mock/providers/beta/skills"
    ));

    mocks.existsSync.mockImplementation((path: string) => (
      path === "/mock/providers/alpha/skills/skill-c"
      || path === "/mock/providers/beta/skills/skill-c"
      || path === "/mock/canonical/skills/skill-c"
    ));

    mocks.rm.mockImplementation((path: string) => {
      if (path === "/mock/providers/beta/skills/skill-c") {
        throw new Error("busy");
      }
    });

    const result = await removeSkill("skill-c", [alpha, beta], true);

    expect(result).toEqual({
      removed: ["alpha"],
      errors: ["beta: busy"],
    });
    expect(mocks.rm).toHaveBeenCalledWith("/mock/canonical/skills/skill-c", { recursive: true });
  });

  it("reports canonical removal errors", async () => {
    const alpha = provider({ id: "alpha" });

    mocks.resolveProviderSkillsDir.mockReturnValue("/mock/providers/alpha/skills");
    mocks.existsSync.mockImplementation((path: string) => (
      path === "/mock/providers/alpha/skills/skill-d" || path === "/mock/canonical/skills/skill-d"
    ));

    mocks.rm.mockImplementation((path: string) => {
      if (path === "/mock/canonical/skills/skill-d") {
        throw new Error("canonical locked");
      }
    });

    const result = await removeSkill("skill-d", [alpha], true);

    expect(result.removed).toEqual(["alpha"]);
    expect(result.errors).toEqual(["canonical: canonical locked"]);
  });

  it("lists canonical skills from directories and symlinks only", async () => {
    mocks.existsSync.mockImplementation((path: string) => path === "/mock/canonical/skills");
    mocks.readdir.mockResolvedValue([
      {
        name: "alpha",
        isDirectory: () => true,
        isSymbolicLink: () => false,
      },
      {
        name: "beta-link",
        isDirectory: () => false,
        isSymbolicLink: () => true,
      },
      {
        name: "README.md",
        isDirectory: () => false,
        isSymbolicLink: () => false,
      },
    ]);

    await expect(listCanonicalSkills()).resolves.toEqual(["alpha", "beta-link"]);
    expect(mocks.readdir).toHaveBeenCalledWith("/mock/canonical/skills", { withFileTypes: true });
  });

  it("returns empty canonical skill list when directory is missing", async () => {
    mocks.existsSync.mockReturnValue(false);

    await expect(listCanonicalSkills()).resolves.toEqual([]);
    expect(mocks.readdir).not.toHaveBeenCalled();
  });
});
