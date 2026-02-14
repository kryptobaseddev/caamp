import { Command } from "commander";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  discoverSkillsMulti: vi.fn(),
  getProvider: vi.fn(),
  getInstalledProviders: vi.fn(),
  resolveProviderSkillsDir: vi.fn(),
  getTrackedSkills: vi.fn(),
  checkSkillUpdate: vi.fn(),
  recordSkillInstall: vi.fn(),
  removeSkillFromLock: vi.fn(),
  installSkill: vi.fn(),
  removeSkill: vi.fn(),
  listCanonicalSkills: vi.fn(),
  scanDirectory: vi.fn(),
  scanFile: vi.fn(),
  toSarif: vi.fn(),
  validateSkill: vi.fn(),
  parseSource: vi.fn(),
  isMarketplaceScoped: vi.fn(),
  cloneRepo: vi.fn(),
  cloneGitLabRepo: vi.fn(),
  existsSync: vi.fn(),
  statSync: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("../../src/core/skills/discovery.js", () => ({
  discoverSkillsMulti: mocks.discoverSkillsMulti,
  discoverSkill: vi.fn(),
}));

vi.mock("../../src/core/registry/providers.js", () => ({
  getProvider: mocks.getProvider,
}));

vi.mock("../../src/core/registry/detection.js", () => ({
  getInstalledProviders: mocks.getInstalledProviders,
}));

vi.mock("../../src/core/paths/standard.js", () => ({
  resolveProviderSkillsDir: mocks.resolveProviderSkillsDir,
  buildSkillSubPathCandidates: vi.fn(() => ["skills/demo"]),
}));

vi.mock("../../src/core/skills/lock.js", () => ({
  getTrackedSkills: mocks.getTrackedSkills,
  checkSkillUpdate: mocks.checkSkillUpdate,
  recordSkillInstall: mocks.recordSkillInstall,
  removeSkillFromLock: mocks.removeSkillFromLock,
}));

vi.mock("../../src/core/skills/installer.js", () => ({
  installSkill: mocks.installSkill,
  removeSkill: mocks.removeSkill,
  listCanonicalSkills: mocks.listCanonicalSkills,
}));

vi.mock("../../src/core/skills/catalog.js", () => ({
  isCatalogAvailable: vi.fn(() => true),
  resolveProfile: vi.fn(() => []),
  listProfiles: vi.fn(() => []),
  getSkill: vi.fn(() => undefined),
  getSkillDir: vi.fn(() => "/tmp/skill"),
  listSkills: vi.fn(() => ["demo"]),
}));

vi.mock("../../src/core/skills/audit/scanner.js", () => ({
  scanDirectory: mocks.scanDirectory,
  scanFile: mocks.scanFile,
  toSarif: mocks.toSarif,
}));

vi.mock("../../src/core/skills/validator.js", () => ({
  validateSkill: mocks.validateSkill,
}));

vi.mock("../../src/core/sources/parser.js", () => ({
  parseSource: mocks.parseSource,
  isMarketplaceScoped: mocks.isMarketplaceScoped,
}));

vi.mock("../../src/core/marketplace/client.js", () => ({
  MarketplaceClient: class {
    getSkill = vi.fn();
    search = vi.fn(async () => []);
  },
}));

vi.mock("../../src/core/network/fetch.js", () => ({
  formatNetworkError: vi.fn(() => "network failed"),
}));

vi.mock("../../src/core/sources/github.js", () => ({
  cloneRepo: mocks.cloneRepo,
}));

vi.mock("../../src/core/sources/gitlab.js", () => ({
  cloneGitLabRepo: mocks.cloneGitLabRepo,
}));

vi.mock("node:fs", () => ({
  existsSync: mocks.existsSync,
  statSync: mocks.statSync,
}));

vi.mock("node:fs/promises", () => ({
  mkdir: mocks.mkdir,
  writeFile: mocks.writeFile,
}));

vi.mock("@cleocode/lafs-protocol", () => ({
  resolveOutputFormat: vi.fn(() => ({ format: "human" })),
}));

vi.mock("../../src/core/skills/recommendation.js", () => ({
  RECOMMENDATION_ERROR_CODES: {
    QUERY_INVALID: "E_SKILLS_QUERY_INVALID",
    NO_MATCHES: "E_SKILLS_NO_MATCHES",
    SOURCE_UNAVAILABLE: "E_SKILLS_SOURCE_UNAVAILABLE",
    CRITERIA_CONFLICT: "E_SKILLS_CRITERIA_CONFLICT",
  },
  tokenizeCriteriaValue: vi.fn((value: string) => [value.toLowerCase()]),
}));

vi.mock("../../src/core/skills/recommendation-api.js", () => ({
  recommendSkills: vi.fn(),
  formatSkillRecommendations: vi.fn(() => ""),
}));

import { registerSkillsCommands } from "../../src/commands/skills/index.js";

const provider = {
  id: "claude-code",
  toolName: "Claude Code",
};

describe("integration: skills commands", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.discoverSkillsMulti.mockReset();
    mocks.getProvider.mockReset();
    mocks.getInstalledProviders.mockReset();
    mocks.resolveProviderSkillsDir.mockReset();
    mocks.getTrackedSkills.mockReset();
    mocks.checkSkillUpdate.mockReset();
    mocks.recordSkillInstall.mockReset();
    mocks.removeSkillFromLock.mockReset();
    mocks.installSkill.mockReset();
    mocks.removeSkill.mockReset();
    mocks.listCanonicalSkills.mockReset();
    mocks.scanDirectory.mockReset();
    mocks.scanFile.mockReset();
    mocks.toSarif.mockReset();
    mocks.validateSkill.mockReset();
    mocks.parseSource.mockReset();
    mocks.isMarketplaceScoped.mockReset();
    mocks.cloneRepo.mockReset();
    mocks.cloneGitLabRepo.mockReset();
    mocks.existsSync.mockReset();
    mocks.statSync.mockReset();
    mocks.mkdir.mockReset();
    mocks.writeFile.mockReset();

    mocks.getProvider.mockImplementation((name: string) => (name === "claude-code" ? provider : undefined));
    mocks.getInstalledProviders.mockReturnValue([provider]);
    mocks.resolveProviderSkillsDir.mockReturnValue("/repo/.claude/skills");
    mocks.discoverSkillsMulti.mockResolvedValue([
      {
        name: "docs-helper",
        scopedName: "docs-helper",
        path: "/repo/.claude/skills/docs-helper",
        metadata: { name: "docs-helper", description: "Docs helper" },
      },
    ]);
    mocks.getTrackedSkills.mockResolvedValue({});
    mocks.checkSkillUpdate.mockResolvedValue({ hasUpdate: false, status: "up-to-date" });
    mocks.scanDirectory.mockResolvedValue([]);
    mocks.scanFile.mockResolvedValue({ file: "/tmp/SKILL.md", findings: [], score: 100, passed: true });
    mocks.toSarif.mockReturnValue({ runs: [] });
    mocks.validateSkill.mockResolvedValue({ valid: true, issues: [] });
    mocks.parseSource.mockReturnValue({ type: "local", inferredName: "demo", value: "./demo" });
    mocks.isMarketplaceScoped.mockReturnValue(false);
    mocks.existsSync.mockReturnValue(true);
    mocks.statSync.mockReturnValue({ isFile: () => false });
    mocks.mkdir.mockResolvedValue(undefined);
    mocks.writeFile.mockResolvedValue(undefined);
    mocks.removeSkill.mockResolvedValue({ removed: [], errors: [] });
    mocks.listCanonicalSkills.mockResolvedValue([]);
    mocks.installSkill.mockResolvedValue({
      success: true,
      linkedAgents: ["claude-code"],
      canonicalPath: "/tmp/canonical/demo",
      errors: [],
    });
    mocks.cloneRepo.mockResolvedValue({ localPath: "/tmp/repo", cleanup: vi.fn(async () => undefined) });
    mocks.cloneGitLabRepo.mockResolvedValue({ localPath: "/tmp/gitlab", cleanup: vi.fn(async () => undefined) });
  });

  it("registers the full skills command group", () => {
    const program = new Command();
    registerSkillsCommands(program);

    const skills = program.commands.find((command) => command.name() === "skills");
    const names = (skills?.commands ?? []).map((command) => command.name());

    expect(names).toEqual(["install", "remove", "list", "find", "check", "update", "init", "audit", "validate"]);
  });

  it("lists discovered skills as json", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const program = new Command();
    registerSkillsCommands(program);

    await program.parseAsync(["node", "test", "skills", "list", "--json"]);

    expect(mocks.getInstalledProviders).toHaveBeenCalledTimes(1);
    expect(mocks.resolveProviderSkillsDir).toHaveBeenCalledWith(provider, "project");
    expect(JSON.parse(String(logSpy.mock.calls[0]?.[0] ?? "[]"))).toEqual([
      {
        name: "docs-helper",
        scopedName: "docs-helper",
        path: "/repo/.claude/skills/docs-helper",
        metadata: { name: "docs-helper", description: "Docs helper" },
      },
    ]);
  });

  it("fails skills list when agent is unknown", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process-exit");
    }) as never);

    const program = new Command();
    registerSkillsCommands(program);

    await expect(program.parseAsync(["node", "test", "skills", "list", "--agent", "ghost"])).rejects.toThrow(
      "process-exit",
    );

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Provider not found: ghost"));
  });

  it("reports check no-op when no tracked skills exist", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const program = new Command();
    registerSkillsCommands(program);

    await program.parseAsync(["node", "test", "skills", "check"]);

    expect(mocks.getTrackedSkills).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("No tracked skills."));
  });

  it("lists global skills in human output", async () => {
    mocks.discoverSkillsMulti.mockResolvedValue([]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const program = new Command();
    registerSkillsCommands(program);

    await program.parseAsync(["node", "test", "skills", "list", "--global"]);

    expect(mocks.resolveProviderSkillsDir).toHaveBeenCalledWith(provider, "global");
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("No skills found."));
  });

  it("prints human-readable update statuses for tracked skills", async () => {
    mocks.getTrackedSkills.mockResolvedValue({
      alpha: { source: "github:foo/alpha", agents: ["claude-code"] },
      beta: { source: "github:foo/beta", agents: ["claude-code"] },
      gamma: { source: "github:foo/gamma", agents: ["claude-code"] },
    });
    mocks.checkSkillUpdate
      .mockResolvedValueOnce({ hasUpdate: true, status: "update-available", currentVersion: "abc123456789000", latestVersion: "def" })
      .mockResolvedValueOnce({ hasUpdate: false, status: "up-to-date", currentVersion: "zzz" })
      .mockResolvedValueOnce({ hasUpdate: false, status: "unknown" });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const program = new Command();
    registerSkillsCommands(program);

    await program.parseAsync(["node", "test", "skills", "check"]);

    const output = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("1 update(s) available.");
    expect(output).toContain("source: github:foo/alpha");
    expect(output).toContain("agents: claude-code");
    expect(output).toContain("unknown");
  });

  it("returns check results as json", async () => {
    mocks.getTrackedSkills.mockResolvedValue({
      alpha: { source: "github:foo/alpha", agents: ["claude-code"] },
    });
    mocks.checkSkillUpdate.mockResolvedValue({ hasUpdate: false, status: "up-to-date" });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const program = new Command();
    registerSkillsCommands(program);

    await program.parseAsync(["node", "test", "skills", "check", "--json"]);

    expect(JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "[]"))).toEqual([
      {
        name: "alpha",
        entry: { source: "github:foo/alpha", agents: ["claude-code"] },
        hasUpdate: false,
        status: "up-to-date",
      },
    ]);
  });

  it("creates a new skill template from init", async () => {
    mocks.existsSync.mockReturnValue(false);
    const program = new Command();
    registerSkillsCommands(program);

    await program.parseAsync(["node", "test", "skills", "init", "demo", "--dir", "/tmp/out"]);

    expect(mocks.mkdir).toHaveBeenCalledWith("/tmp/out/demo", { recursive: true });
    expect(mocks.writeFile).toHaveBeenCalledWith(
      "/tmp/out/demo/SKILL.md",
      expect.stringContaining("name: demo"),
      "utf-8",
    );
  });

  it("fails init when target directory already exists", async () => {
    mocks.existsSync.mockReturnValue(true);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process-exit");
    }) as never);
    const program = new Command();
    registerSkillsCommands(program);

    await expect(program.parseAsync(["node", "test", "skills", "init", "demo"]))
      .rejects.toThrow("process-exit");

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Directory already exists"));
  });

  it("runs audit in sarif mode for a single file", async () => {
    mocks.existsSync.mockReturnValue(true);
    mocks.statSync.mockReturnValue({ isFile: () => true });
    mocks.scanFile.mockResolvedValue({ file: "/tmp/SKILL.md", findings: [], score: 100, passed: true });
    mocks.toSarif.mockReturnValue({ version: "2.1.0" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const program = new Command();
    registerSkillsCommands(program);

    await program.parseAsync(["node", "test", "skills", "audit", "/tmp/SKILL.md", "--sarif"]);

    expect(mocks.scanFile).toHaveBeenCalledWith("/tmp/SKILL.md");
    expect(JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}"))).toEqual({ version: "2.1.0" });
  });

  it("fails audit when path does not exist", async () => {
    mocks.existsSync.mockReturnValue(false);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process-exit");
    }) as never);
    const program = new Command();
    registerSkillsCommands(program);

    await expect(program.parseAsync(["node", "test", "skills", "audit", "/missing"]))
      .rejects.toThrow("process-exit");

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Path not found"));
  });

  it("prints human audit output and exits on failed findings", async () => {
    mocks.existsSync.mockReturnValue(true);
    mocks.statSync.mockReturnValue({ isFile: () => false });
    mocks.scanDirectory.mockResolvedValue([
      {
        file: "/tmp/a/SKILL.md",
        score: 72,
        passed: false,
        findings: [{ line: 2, context: "danger", rule: { id: "R1", name: "Rule", severity: "critical" } }],
      },
    ]);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process-exit");
    }) as never);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const program = new Command();
    registerSkillsCommands(program);

    await expect(program.parseAsync(["node", "test", "skills", "audit", "/tmp/a"]))
      .rejects.toThrow("process-exit");

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(logSpy.mock.calls.map((call) => String(call[0])).join("\n")).toContain("1 finding(s)");
  });

  it("validates skills and exits on errors", async () => {
    mocks.validateSkill.mockResolvedValue({
      valid: false,
      issues: [{ level: "error", field: "name", message: "name is required" }],
    });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process-exit");
    }) as never);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const program = new Command();
    registerSkillsCommands(program);

    await expect(program.parseAsync(["node", "test", "skills", "validate", "SKILL.md"]))
      .rejects.toThrow("process-exit");

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(logSpy.mock.calls.map((call) => String(call[0])).join("\n")).toContain("[name] name is required");
  });

  it("removes named skill and updates lock", async () => {
    mocks.removeSkill.mockResolvedValue({ removed: ["claude-code"], errors: ["warn one"] });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const program = new Command();
    registerSkillsCommands(program);

    await program.parseAsync(["node", "test", "skills", "remove", "demo"]);

    expect(mocks.removeSkillFromLock).toHaveBeenCalledWith("demo");
    expect(logSpy.mock.calls.map((call) => String(call[0])).join("\n")).toContain("warn one");
  });

  it("shows interactive remove guidance when no skill name is provided", async () => {
    mocks.listCanonicalSkills.mockResolvedValue(["alpha", "beta"]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const program = new Command();
    registerSkillsCommands(program);

    await program.parseAsync(["node", "test", "skills", "remove"]);

    const output = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("Installed skills:");
    expect(output).toContain("Use: caamp skills remove <name>");
  });

  it("updates outdated tracked skills across success and failure paths", async () => {
    const cleanup = vi.fn(async () => undefined);
    mocks.getTrackedSkills.mockResolvedValue({
      alpha: {
        scopedName: "alpha",
        source: "gh:alpha",
        sourceType: "github",
        agents: ["claude-code"],
        isGlobal: false,
        projectDir: "/repo",
      },
      beta: {
        scopedName: "beta",
        source: "local:beta",
        sourceType: "local",
        agents: ["claude-code"],
        isGlobal: false,
        projectDir: "/repo",
      },
      gamma: {
        scopedName: "gamma",
        source: "gh:gamma",
        sourceType: "github",
        agents: ["ghost"],
        isGlobal: false,
        projectDir: "/repo",
      },
    });
    mocks.checkSkillUpdate
      .mockResolvedValueOnce({ hasUpdate: true, currentVersion: "old", latestVersion: "new" })
      .mockResolvedValueOnce({ hasUpdate: true, currentVersion: "old", latestVersion: "new" })
      .mockResolvedValueOnce({ hasUpdate: true, currentVersion: "old", latestVersion: "new" });
    mocks.parseSource.mockImplementation((source: string) => {
      if (source === "gh:alpha") return { type: "github", owner: "a", repo: "alpha", ref: "main", path: "skills/alpha" };
      if (source === "local:beta") return { type: "local" };
      return { type: "github", owner: "a", repo: "gamma", ref: "main" };
    });
    mocks.cloneRepo
      .mockResolvedValueOnce({ localPath: "/tmp/alpha", cleanup })
      .mockResolvedValueOnce({ localPath: "/tmp/gamma", cleanup });
    mocks.installSkill.mockResolvedValue({
      success: true,
      linkedAgents: ["claude-code"],
      canonicalPath: "/tmp/canonical/alpha",
      errors: [],
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const program = new Command();
    registerSkillsCommands(program);

    await program.parseAsync(["node", "test", "skills", "update", "--yes"]);

    expect(mocks.recordSkillInstall).toHaveBeenCalledWith(
      "alpha",
      "alpha",
      "gh:alpha",
      "github",
      ["claude-code"],
      "/tmp/canonical/alpha",
      false,
      "/repo",
      "new",
    );
    expect(cleanup).toHaveBeenCalledTimes(2);
    const output = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("Skipped beta: source type \"local\" does not support auto-update");
    expect(output).toContain("Skipped gamma: no valid providers found");
    expect(output).toContain("Updated 1 skill(s).");
  });

  it("reports failed updates and all-up-to-date cases", async () => {
    mocks.getTrackedSkills.mockResolvedValue({
      alpha: {
        scopedName: "alpha",
        source: "gh:alpha",
        sourceType: "github",
        agents: ["claude-code"],
        isGlobal: false,
        projectDir: "/repo",
      },
    });
    mocks.checkSkillUpdate
      .mockResolvedValueOnce({ hasUpdate: true, currentVersion: "old", latestVersion: "new" });
    mocks.parseSource.mockReturnValue({ type: "github", owner: "a", repo: "alpha" });
    mocks.cloneRepo.mockRejectedValue(new Error("clone failed"));
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const program = new Command();
    registerSkillsCommands(program);

    await program.parseAsync(["node", "test", "skills", "update", "--yes"]);
    expect(logSpy.mock.calls.map((call) => String(call[0])).join("\n")).toContain("Failed to update 1 skill(s).");

    mocks.getTrackedSkills.mockResolvedValue({ alpha: { source: "gh:alpha", agents: ["claude-code"] } });
    mocks.checkSkillUpdate.mockResolvedValue({ hasUpdate: false });
    logSpy.mockClear();
    await program.parseAsync(["node", "test", "skills", "update", "--yes"]);
    expect(logSpy.mock.calls.map((call) => String(call[0])).join("\n")).toContain("All skills are up to date.");
  });
});
