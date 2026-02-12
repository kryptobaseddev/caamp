import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  parseSource: vi.fn(),
  isMarketplaceScoped: vi.fn(),
  installSkill: vi.fn(),
  recordSkillInstall: vi.fn(),
  getInstalledProviders: vi.fn(),
  getProvider: vi.fn(),
  cloneRepo: vi.fn(),
  cloneGitLabRepo: vi.fn(),
  marketplaceGetSkill: vi.fn(),
  formatNetworkError: vi.fn(),
  existsSync: vi.fn(),
}));

vi.mock("node:fs", () => ({
  existsSync: mocks.existsSync,
}));

vi.mock("../../src/core/sources/parser.js", () => ({
  parseSource: mocks.parseSource,
  isMarketplaceScoped: mocks.isMarketplaceScoped,
}));

vi.mock("../../src/core/skills/installer.js", () => ({
  installSkill: mocks.installSkill,
}));

vi.mock("../../src/core/skills/lock.js", () => ({
  recordSkillInstall: mocks.recordSkillInstall,
}));

vi.mock("../../src/core/registry/detection.js", () => ({
  getInstalledProviders: mocks.getInstalledProviders,
}));

vi.mock("../../src/core/registry/providers.js", () => ({
  getProvider: mocks.getProvider,
}));

vi.mock("../../src/core/sources/github.js", () => ({
  cloneRepo: mocks.cloneRepo,
}));

vi.mock("../../src/core/sources/gitlab.js", () => ({
  cloneGitLabRepo: mocks.cloneGitLabRepo,
}));

vi.mock("../../src/core/network/fetch.js", () => ({
  formatNetworkError: mocks.formatNetworkError,
}));

vi.mock("../../src/core/marketplace/client.js", () => ({
  MarketplaceClient: class {
    getSkill = mocks.marketplaceGetSkill;
  },
}));

import { registerSkillsInstall } from "../../src/commands/skills/install.js";

const provider = {
  id: "claude-code",
  toolName: "Claude Code",
};

describe("integration: skills install command", () => {
  beforeEach(() => {
    mocks.parseSource.mockReset();
    mocks.isMarketplaceScoped.mockReset();
    mocks.installSkill.mockReset();
    mocks.recordSkillInstall.mockReset();
    mocks.getInstalledProviders.mockReset();
    mocks.getProvider.mockReset();
    mocks.cloneRepo.mockReset();
    mocks.cloneGitLabRepo.mockReset();
    mocks.marketplaceGetSkill.mockReset();
    mocks.formatNetworkError.mockReset();
    mocks.existsSync.mockReset();

    mocks.isMarketplaceScoped.mockReturnValue(false);
    mocks.parseSource.mockReturnValue({ type: "local", inferredName: "demo", value: "/tmp/demo" });
    mocks.getInstalledProviders.mockReturnValue([provider]);
    mocks.installSkill.mockResolvedValue({
      success: true,
      canonicalPath: "/tmp/canonical/demo",
      linkedAgents: ["claude-code"],
      errors: [],
    });
    mocks.recordSkillInstall.mockResolvedValue(undefined);
    mocks.cloneRepo.mockResolvedValue({ localPath: "/tmp/repo", cleanup: async () => {} });
    mocks.cloneGitLabRepo.mockResolvedValue({ localPath: "/tmp/repo", cleanup: async () => {} });
    mocks.formatNetworkError.mockReturnValue("network failed");
    mocks.existsSync.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("installs local source and records lock entry", async () => {
    const program = new Command();
    registerSkillsInstall(program);

    await program.parseAsync(["node", "test", "install", "./skill", "--all"]);

    expect(mocks.installSkill).toHaveBeenCalled();
    expect(mocks.recordSkillInstall).toHaveBeenCalled();
  });

  it("installs marketplace scoped source via GitHub clone", async () => {
    mocks.isMarketplaceScoped.mockReturnValue(true);
    mocks.marketplaceGetSkill.mockResolvedValue({
      name: "demo",
      author: "alice",
      repoFullName: "alice/demo",
      githubUrl: "https://github.com/alice/demo",
      path: "skills/demo/SKILL.md",
    });
    mocks.parseSource.mockReturnValueOnce({ type: "github", owner: "alice", repo: "demo", ref: "main" });

    const program = new Command();
    registerSkillsInstall(program);

    await program.parseAsync(["node", "test", "install", "@alice/demo", "--all"]);

    expect(mocks.cloneRepo).toHaveBeenCalled();
    expect(mocks.installSkill).toHaveBeenCalled();
  });

  it("falls back to parsed GitHub path when marketplace path is incomplete", async () => {
    mocks.isMarketplaceScoped.mockReturnValue(true);
    mocks.marketplaceGetSkill.mockResolvedValue({
      name: "demo",
      author: "alice",
      repoFullName: "alice/demo",
      githubUrl: "https://github.com/alice/demo/tree/main/.claude/skills/demo",
      path: "skills/demo/SKILL.md",
    });
    mocks.parseSource.mockReturnValueOnce({
      type: "github",
      owner: "alice",
      repo: "demo",
      ref: "main",
      path: ".claude/skills/demo",
    });
    mocks.cloneRepo
      .mockResolvedValueOnce({ localPath: "/tmp/repo/skills/demo", cleanup: async () => {} })
      .mockResolvedValueOnce({ localPath: "/tmp/repo/.claude/skills/demo", cleanup: async () => {} });
    mocks.existsSync
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    const program = new Command();
    registerSkillsInstall(program);

    await program.parseAsync(["node", "test", "install", "@alice/demo", "--all"]);

    expect(mocks.cloneRepo).toHaveBeenNthCalledWith(1, "alice", "demo", "main", "skills/demo");
    expect(mocks.cloneRepo).toHaveBeenNthCalledWith(2, "alice", "demo", "main", ".claude/skills/demo");
    expect(mocks.installSkill).toHaveBeenCalled();
  });

  it("exits when no providers are available", async () => {
    mocks.getInstalledProviders.mockReturnValue([]);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process-exit");
    }) as never);

    const program = new Command();
    registerSkillsInstall(program);

    await expect(program.parseAsync(["node", "test", "install", "./skill", "--all"])).rejects.toThrow("process-exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
