import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execFileSync: vi.fn(),
  getAllProviders: vi.fn(),
  getProviderCount: vi.fn(),
  detectAllProviders: vi.fn(),
  readLockFile: vi.fn(),
  readConfig: vi.fn(),
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  lstatSync: vi.fn(),
  readlinkSync: vi.fn(),
  getCaampVersion: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFileSync: mocks.execFileSync,
}));

vi.mock("node:fs", () => ({
  existsSync: mocks.existsSync,
  readdirSync: mocks.readdirSync,
  lstatSync: mocks.lstatSync,
  readlinkSync: mocks.readlinkSync,
}));

vi.mock("../../src/core/registry/providers.js", () => ({
  getAllProviders: mocks.getAllProviders,
  getProviderCount: mocks.getProviderCount,
}));

vi.mock("../../src/core/registry/detection.js", () => ({
  detectAllProviders: mocks.detectAllProviders,
}));

vi.mock("../../src/core/mcp/lock.js", () => ({
  readLockFile: mocks.readLockFile,
}));

vi.mock("../../src/core/formats/index.js", () => ({
  readConfig: mocks.readConfig,
}));

vi.mock("../../src/core/version.js", () => ({
  getCaampVersion: mocks.getCaampVersion,
}));

import { registerDoctorCommand } from "../../src/commands/doctor.js";

describe("doctor command", () => {
  beforeEach(() => {
    mocks.execFileSync.mockReset();
    mocks.getAllProviders.mockReset();
    mocks.getProviderCount.mockReset();
    mocks.detectAllProviders.mockReset();
    mocks.readLockFile.mockReset();
    mocks.readConfig.mockReset();
    mocks.existsSync.mockReset();
    mocks.readdirSync.mockReset();
    mocks.lstatSync.mockReset();
    mocks.readlinkSync.mockReset();
    mocks.getCaampVersion.mockReset();

    mocks.execFileSync.mockReturnValue("10.0.0");
    mocks.getCaampVersion.mockReturnValue("0.3.0");
    mocks.getAllProviders.mockReturnValue([]);
    mocks.getProviderCount.mockReturnValue(44);
    mocks.detectAllProviders.mockReturnValue([]);
    mocks.readLockFile.mockResolvedValue({ version: 1, skills: {}, mcpServers: {} });
    mocks.readConfig.mockResolvedValue({});
    mocks.existsSync.mockReturnValue(false);
    mocks.readdirSync.mockReturnValue([]);
    mocks.lstatSync.mockReturnValue({ isSymbolicLink: () => false });
    mocks.readlinkSync.mockReturnValue("/some/path");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("outputs json report", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const program = new Command();
    registerDoctorCommand(program);

    await program.parseAsync(["node", "test", "doctor", "--json"]);

    expect(logSpy).toHaveBeenCalled();
    const output = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      version: string;
      sections: unknown[];
      summary: { passed: number; warnings: number; errors: number };
    };
    expect(output.version).toBe("0.3.0");
    expect(Array.isArray(output.sections)).toBe(true);
    expect(output.summary.errors).toBeGreaterThanOrEqual(0);
  });

  it("exits non-zero when checks fail", async () => {
    mocks.readLockFile.mockRejectedValue(new Error("lock failure"));

    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process-exit");
    }) as never);

    const program = new Command();
    registerDoctorCommand(program);

    await expect(program.parseAsync(["node", "test", "doctor"])).rejects.toThrow("process-exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("outputs human-readable report", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const program = new Command();
    registerDoctorCommand(program);

    await program.parseAsync(["node", "test", "doctor"]);

    // Human-readable mode prints multiple console.log calls (sections + summary)
    expect(logSpy.mock.calls.length).toBeGreaterThan(1);

    const allOutput = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(allOutput).toContain("Environment");
    expect(allOutput).toContain("Registry");
    expect(allOutput).toContain("Installed Providers");
    expect(allOutput).toContain("Skills");
    expect(allOutput).toContain("Lock File");
    expect(allOutput).toContain("Config Files");
    expect(allOutput).toContain("Summary");
  });

  it("reports npm not found when execFileSync throws", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mocks.execFileSync.mockImplementation(() => {
      throw new Error("not found");
    });

    const program = new Command();
    registerDoctorCommand(program);

    await program.parseAsync(["node", "test", "doctor", "--json"]);

    const output = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      sections: Array<{ name: string; checks: Array<{ label: string; status: string }> }>;
    };
    const envSection = output.sections.find((s) => s.name === "Environment");
    expect(envSection).toBeDefined();
    const npmCheck = envSection!.checks.find((c) => c.label.includes("npm"));
    expect(npmCheck).toBeDefined();
    expect(npmCheck!.label).toBe("npm not found");
    expect(npmCheck!.status).toBe("warn");
  });

  it("reports malformed provider entries", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mocks.getAllProviders.mockReturnValue([
      { id: "test", toolName: "", configKey: "", configFormat: "" },
    ]);

    const program = new Command();
    registerDoctorCommand(program);

    await program.parseAsync(["node", "test", "doctor", "--json"]);

    const output = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      sections: Array<{ name: string; checks: Array<{ label: string; status: string; detail?: string }> }>;
    };
    const registrySection = output.sections.find((s) => s.name === "Registry");
    expect(registrySection).toBeDefined();
    const malformedCheck = registrySection!.checks.find((c) => c.label.includes("malformed"));
    expect(malformedCheck).toBeDefined();
    expect(malformedCheck!.status).toBe("fail");
    expect(malformedCheck!.detail).toContain("test");
  });

  it("reports installed providers with detection methods", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mocks.detectAllProviders.mockReturnValue([
      {
        installed: true,
        provider: {
          id: "claude-code",
          toolName: "Claude Code",
          pathSkills: "/skills",
          configPathGlobal: "/config",
          configKey: "mcpServers",
          configFormat: "json",
        },
        methods: ["binary", "config"],
      },
    ]);

    const program = new Command();
    registerDoctorCommand(program);

    await program.parseAsync(["node", "test", "doctor", "--json"]);

    const output = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      sections: Array<{ name: string; checks: Array<{ label: string; status: string }> }>;
    };
    const providersSection = output.sections.find((s) => s.name === "Installed Providers");
    expect(providersSection).toBeDefined();
    const providerCheck = providersSection!.checks.find((c) => c.label.includes("Claude Code"));
    expect(providerCheck).toBeDefined();
    expect(providerCheck!.label).toContain("binary");
    expect(providerCheck!.label).toContain("config");
    expect(providerCheck!.status).toBe("pass");
  });

  it("checks canonical skills directory with entries", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mocks.existsSync.mockReturnValue(true);
    mocks.readdirSync.mockReturnValue(["skill1", "skill2"]);
    mocks.lstatSync.mockReturnValue({
      isDirectory: () => true,
      isSymbolicLink: () => false,
    });

    const program = new Command();
    registerDoctorCommand(program);

    await program.parseAsync(["node", "test", "doctor", "--json"]);

    const output = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      sections: Array<{ name: string; checks: Array<{ label: string; status: string }> }>;
    };
    const skillsSection = output.sections.find((s) => s.name === "Skills");
    expect(skillsSection).toBeDefined();
    const canonicalCheck = skillsSection!.checks.find((c) => c.label.includes("canonical"));
    expect(canonicalCheck).toBeDefined();
    expect(canonicalCheck!.label).toContain("2");
    expect(canonicalCheck!.status).toBe("pass");
  });

  it("checks config files for installed providers", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mocks.detectAllProviders.mockReturnValue([
      {
        installed: true,
        provider: {
          id: "claude-code",
          toolName: "Claude Code",
          pathSkills: "/skills",
          configPathGlobal: "/home/user/.claude/config.json",
          configKey: "mcpServers",
          configFormat: "json",
        },
        methods: ["binary"],
      },
    ]);
    mocks.existsSync.mockReturnValue(true);
    mocks.readdirSync.mockReturnValue([]);
    mocks.lstatSync.mockReturnValue({
      isDirectory: () => false,
      isSymbolicLink: () => false,
    });
    mocks.readConfig.mockResolvedValue({ mcpServers: {} });

    const program = new Command();
    registerDoctorCommand(program);

    await program.parseAsync(["node", "test", "doctor", "--json"]);

    const output = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      sections: Array<{ name: string; checks: Array<{ label: string; status: string }> }>;
    };
    const configSection = output.sections.find((s) => s.name === "Config Files");
    expect(configSection).toBeDefined();
    const configCheck = configSection!.checks.find((c) => c.label.includes("claude-code"));
    expect(configCheck).toBeDefined();
    expect(configCheck!.label).toContain("readable");
    expect(configCheck!.status).toBe("pass");
  });

  it("reports lock file orphaned entries", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mocks.readLockFile.mockResolvedValue({
      version: 1,
      skills: {
        "dead-skill": {
          canonicalPath: "/nonexistent/path/dead-skill",
          agents: [],
        },
      },
      mcpServers: {},
    });
    // existsSync returns false by default (set in beforeEach), so canonicalPath check will fail

    const program = new Command();
    registerDoctorCommand(program);

    await program.parseAsync(["node", "test", "doctor", "--json"]);

    const output = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      sections: Array<{ name: string; checks: Array<{ label: string; status: string; detail?: string }> }>;
    };
    const lockSection = output.sections.find((s) => s.name === "Lock File");
    expect(lockSection).toBeDefined();
    const orphanedCheck = lockSection!.checks.find((c) => c.label.includes("orphaned"));
    expect(orphanedCheck).toBeDefined();
    expect(orphanedCheck!.status).toBe("warn");
    expect(orphanedCheck!.detail).toContain("dead-skill");
  });

  it("reports untracked skills on disk", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    // Lock file has no skills
    mocks.readLockFile.mockResolvedValue({
      version: 1,
      skills: {},
      mcpServers: {},
    });
    // existsSync: true so canonical dir "exists", and lock file untracked check proceeds
    mocks.existsSync.mockReturnValue(true);
    // readdirSync returns skills that are NOT in the lock
    mocks.readdirSync.mockReturnValue(["mystery-skill", "rogue-skill"]);
    mocks.lstatSync.mockReturnValue({
      isDirectory: () => true,
      isSymbolicLink: () => false,
    });

    const program = new Command();
    registerDoctorCommand(program);

    await program.parseAsync(["node", "test", "doctor", "--json"]);

    const output = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      sections: Array<{ name: string; checks: Array<{ label: string; status: string; detail?: string }> }>;
    };
    const lockSection = output.sections.find((s) => s.name === "Lock File");
    expect(lockSection).toBeDefined();
    const untrackedCheck = lockSection!.checks.find((c) => c.label.includes("untracked"));
    expect(untrackedCheck).toBeDefined();
    expect(untrackedCheck!.status).toBe("warn");
    expect(untrackedCheck!.detail).toContain("mystery-skill");
    expect(untrackedCheck!.detail).toContain("rogue-skill");
  });

  it("reports broken symlinks in skills check", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const providerSkillDir = "/home/user/.claude/skills";

    // Installed provider with a pathSkills directory
    mocks.detectAllProviders.mockReturnValue([
      {
        installed: true,
        provider: {
          id: "claude-code",
          toolName: "Claude Code",
          pathSkills: providerSkillDir,
          configPathGlobal: "/home/user/.claude/config.json",
          configKey: "mcpServers",
          configFormat: "json",
        },
        methods: ["binary"],
      },
    ]);

    // existsSync: true for canonical dir and provider skill dir, but false for
    // the broken symlink target (the joined fullPath)
    mocks.existsSync.mockImplementation((p: string) => {
      const ps = String(p).replace(/\\/g, "/");
      // The broken symlink: existsSync(join(skillDir, "skill1")) returns false
      if (ps.endsWith("/skill1") && ps.includes(".claude")) return false;
      // Everything else exists
      return true;
    });

    // readdirSync: path-aware so canonical dir returns [] and provider dir returns entries
    mocks.readdirSync.mockImplementation((p: string) => {
      if (String(p).replace(/\\/g, "/").includes(".claude/skills")) return ["skill1"];
      return [];
    });

    mocks.lstatSync.mockReturnValue({
      isSymbolicLink: () => true,
      isDirectory: () => false,
    });

    const program = new Command();
    registerDoctorCommand(program);

    await program.parseAsync(["node", "test", "doctor", "--json"]);

    const output = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      sections: Array<{ name: string; checks: Array<{ label: string; status: string; detail?: string }> }>;
    };
    const skillsSection = output.sections.find((s) => s.name === "Skills");
    expect(skillsSection).toBeDefined();
    const brokenCheck = skillsSection!.checks.find((c) => c.label.includes("broken symlink"));
    expect(brokenCheck).toBeDefined();
    expect(brokenCheck!.status).toBe("warn");
    expect(brokenCheck!.detail).toContain("claude-code/skill1");
  });

  it("reports stale symlinks not pointing to canonical", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const providerSkillDir = "/home/user/.claude/skills";

    mocks.detectAllProviders.mockReturnValue([
      {
        installed: true,
        provider: {
          id: "claude-code",
          toolName: "Claude Code",
          pathSkills: providerSkillDir,
          configPathGlobal: "/home/user/.claude/config.json",
          configKey: "mcpServers",
          configFormat: "json",
        },
        methods: ["binary"],
      },
    ]);

    // All paths exist (canonical dir, provider skill dir, symlink targets)
    mocks.existsSync.mockReturnValue(true);

    // readdirSync: path-aware
    mocks.readdirSync.mockImplementation((p: string) => {
      if (String(p).replace(/\\/g, "/").includes(".claude/skills")) return ["stale-skill"];
      return [];
    });

    mocks.lstatSync.mockReturnValue({
      isSymbolicLink: () => true,
      isDirectory: () => false,
    });

    // readlinkSync returns a path NOT under /.agents/skills/
    mocks.readlinkSync.mockReturnValue("/some/random/other/path/stale-skill");

    const program = new Command();
    registerDoctorCommand(program);

    await program.parseAsync(["node", "test", "doctor", "--json"]);

    const output = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      sections: Array<{ name: string; checks: Array<{ label: string; status: string; detail?: string }> }>;
    };
    const skillsSection = output.sections.find((s) => s.name === "Skills");
    expect(skillsSection).toBeDefined();
    const staleCheck = skillsSection!.checks.find((c) => c.label.includes("stale symlink"));
    expect(staleCheck).toBeDefined();
    expect(staleCheck!.status).toBe("warn");
    expect(staleCheck!.detail).toContain("claude-code/stale-skill");
  });

  it("reports config parse error", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    mocks.detectAllProviders.mockReturnValue([
      {
        installed: true,
        provider: {
          id: "claude-code",
          toolName: "Claude Code",
          pathSkills: "/home/user/.claude/skills",
          configPathGlobal: "/home/user/.claude/config.json",
          configKey: "mcpServers",
          configFormat: "json",
        },
        methods: ["binary"],
      },
    ]);

    // Config file exists on disk
    mocks.existsSync.mockReturnValue(true);
    mocks.readdirSync.mockReturnValue([]);
    mocks.lstatSync.mockReturnValue({
      isSymbolicLink: () => false,
      isDirectory: () => false,
    });

    // readConfig throws a parse error
    mocks.readConfig.mockRejectedValue(new Error("Unexpected token } in JSON at position 42"));

    const program = new Command();
    registerDoctorCommand(program);

    await program.parseAsync(["node", "test", "doctor", "--json"]);

    const output = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      sections: Array<{ name: string; checks: Array<{ label: string; status: string; detail?: string }> }>;
    };
    const configSection = output.sections.find((s) => s.name === "Config Files");
    expect(configSection).toBeDefined();
    const parseErrorCheck = configSection!.checks.find((c) => c.label.includes("config parse error"));
    expect(parseErrorCheck).toBeDefined();
    expect(parseErrorCheck!.status).toBe("fail");
    expect(parseErrorCheck!.detail).toContain("Unexpected token");
  });

  it("reports lock file agent-list mismatches", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    mocks.detectAllProviders.mockReturnValue([
      {
        installed: true,
        provider: {
          id: "claude-code",
          toolName: "Claude Code",
          pathSkills: "/home/user/.claude/skills",
          configPathGlobal: "/home/user/.claude/config.json",
          configKey: "mcpServers",
          configFormat: "json",
        },
        methods: ["binary"],
      },
    ]);

    // Lock file claims a skill is linked to "claude-code" but the symlink is missing
    mocks.readLockFile.mockResolvedValue({
      version: 1,
      skills: {
        "my-skill": {
          canonicalPath: "/home/user/.agents/skills/my-skill",
          agents: ["claude-code"],
        },
      },
      mcpServers: {},
    });

    // existsSync: canonical path exists, but the provider symlink path does NOT
    mocks.existsSync.mockImplementation((p: string) => {
      const ps = String(p).replace(/\\/g, "/");
      // The canonical path for the skill exists (not orphaned)
      if (ps.includes(".agents/skills/my-skill")) return true;
      // The provider symlink path does NOT exist (agent-list mismatch)
      if (ps.includes(".claude/skills/my-skill")) return false;
      // Default: true for canonical dir checks, etc.
      return true;
    });

    mocks.readdirSync.mockReturnValue(["my-skill"]);
    mocks.lstatSync.mockReturnValue({
      isSymbolicLink: () => false,
      isDirectory: () => true,
    });

    const program = new Command();
    registerDoctorCommand(program);

    await program.parseAsync(["node", "test", "doctor", "--json"]);

    const output = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      sections: Array<{ name: string; checks: Array<{ label: string; status: string; detail?: string }> }>;
    };
    const lockSection = output.sections.find((s) => s.name === "Lock File");
    expect(lockSection).toBeDefined();
    const mismatchCheck = lockSection!.checks.find((c) => c.label.includes("agent-list mismatch"));
    expect(mismatchCheck).toBeDefined();
    expect(mismatchCheck!.status).toBe("warn");
    expect(mismatchCheck!.detail).toContain("my-skill");
    expect(mismatchCheck!.detail).toContain("claude-code");
  });

  it("human output includes section formatting with pass/warn/fail icons", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Set up a warning to ensure formatSection renders the warn icon path
    mocks.getAllProviders.mockReturnValue([
      { id: "bad", toolName: "", configKey: "", configFormat: "" },
    ]);

    const program = new Command();
    registerDoctorCommand(program);

    // Run the exit spy so the process.exit(1) from the fail doesn't throw
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process-exit");
    }) as never);

    await expect(program.parseAsync(["node", "test", "doctor"])).rejects.toThrow("process-exit");

    const allOutput = logSpy.mock.calls.map((c) => String(c[0])).join("\n");

    // Verify section names appear in formatted output
    expect(allOutput).toContain("Environment");
    expect(allOutput).toContain("Registry");
    expect(allOutput).toContain("Installed Providers");
    expect(allOutput).toContain("Skills");
    expect(allOutput).toContain("Lock File");
    expect(allOutput).toContain("Config Files");
    expect(allOutput).toContain("Summary");

    // Verify pass icon (✓) appears for passing checks
    expect(allOutput).toContain("✓");
    // Verify fail icon (✗) appears for the malformed entry
    expect(allOutput).toContain("✗");

    exitSpy.mockRestore();
  });

  it("reports no config file found for installed provider", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    mocks.detectAllProviders.mockReturnValue([
      {
        installed: true,
        provider: {
          id: "windsurf",
          toolName: "Windsurf",
          pathSkills: "/home/user/.windsurf/skills",
          configPathGlobal: "/home/user/.windsurf/config.json",
          configKey: "mcpServers",
          configFormat: "json",
        },
        methods: ["binary"],
      },
    ]);

    // Config file does not exist
    mocks.existsSync.mockImplementation((p: string) => {
      if (String(p).includes("config.json")) return false;
      return false;
    });
    mocks.readdirSync.mockReturnValue([]);
    mocks.lstatSync.mockReturnValue({
      isSymbolicLink: () => false,
      isDirectory: () => false,
    });

    const program = new Command();
    registerDoctorCommand(program);

    await program.parseAsync(["node", "test", "doctor", "--json"]);

    const output = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      sections: Array<{ name: string; checks: Array<{ label: string; status: string; detail?: string }> }>;
    };
    const configSection = output.sections.find((s) => s.name === "Config Files");
    expect(configSection).toBeDefined();
    const noConfigCheck = configSection!.checks.find((c) => c.label.includes("no config file found"));
    expect(noConfigCheck).toBeDefined();
    expect(noConfigCheck!.status).toBe("warn");
    expect(noConfigCheck!.detail).toContain("config.json");
  });

  it("reports detection failure in installed providers check", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // detectAllProviders is called by checkInstalledProviders (which catches),
    // checkSkillSymlinks (which does NOT catch), and checkLockFile / checkConfigFiles.
    // We make it throw only on the first call so checkInstalledProviders catches it,
    // then return [] for subsequent calls so the rest of the command can proceed.
    let callCount = 0;
    mocks.detectAllProviders.mockImplementation(() => {
      callCount++;
      if (callCount === 1) throw new Error("detection exploded");
      return [];
    });

    const program = new Command();
    registerDoctorCommand(program);

    // In --json mode, the command returns after printing JSON (no process.exit)
    await program.parseAsync(["node", "test", "doctor", "--json"]);

    const output = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      sections: Array<{ name: string; checks: Array<{ label: string; status: string; detail?: string }> }>;
      summary: { passed: number; warnings: number; errors: number };
    };
    const providersSection = output.sections.find((s) => s.name === "Installed Providers");
    expect(providersSection).toBeDefined();
    const detectionFail = providersSection!.checks.find((c) => c.label.includes("Detection failed"));
    expect(detectionFail).toBeDefined();
    expect(detectionFail!.status).toBe("fail");
    expect(detectionFail!.detail).toContain("detection exploded");
    expect(output.summary.errors).toBeGreaterThanOrEqual(1);
  });

  it("reports registry load failure", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    mocks.getAllProviders.mockImplementation(() => {
      throw new Error("registry corrupted");
    });

    const program = new Command();
    registerDoctorCommand(program);

    await program.parseAsync(["node", "test", "doctor", "--json"]);

    const output = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      sections: Array<{ name: string; checks: Array<{ label: string; status: string; detail?: string }> }>;
    };
    const registrySection = output.sections.find((s) => s.name === "Registry");
    expect(registrySection).toBeDefined();
    const failCheck = registrySection!.checks.find((c) => c.label.includes("Failed to load registry"));
    expect(failCheck).toBeDefined();
    expect(failCheck!.status).toBe("fail");
    expect(failCheck!.detail).toContain("registry corrupted");
  });

  it("reports skills directory unreadable", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Canonical dir exists but readdirSync throws
    mocks.existsSync.mockReturnValue(true);
    mocks.readdirSync.mockImplementation(() => {
      throw new Error("EACCES: permission denied");
    });

    const program = new Command();
    registerDoctorCommand(program);

    await program.parseAsync(["node", "test", "doctor", "--json"]);

    const output = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      sections: Array<{ name: string; checks: Array<{ label: string; status: string }> }>;
    };
    const skillsSection = output.sections.find((s) => s.name === "Skills");
    expect(skillsSection).toBeDefined();
    const unreadableCheck = skillsSection!.checks.find((c) => c.label.includes("Cannot read skills directory"));
    expect(unreadableCheck).toBeDefined();
    expect(unreadableCheck!.status).toBe("warn");
  });

  it("handles unreadable symlink entry in provider skill dir", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const providerSkillDir = "/home/user/.claude/skills";

    mocks.detectAllProviders.mockReturnValue([
      {
        installed: true,
        provider: {
          id: "claude-code",
          toolName: "Claude Code",
          pathSkills: providerSkillDir,
          configPathGlobal: "/home/user/.claude/config.json",
          configKey: "mcpServers",
          configFormat: "json",
        },
        methods: ["binary"],
      },
    ]);

    mocks.existsSync.mockReturnValue(true);

    mocks.readdirSync.mockImplementation((p: string) => {
      if (String(p).replace(/\\/g, "/").includes(".claude/skills")) return ["bad-entry"];
      return [];
    });

    // lstatSync throws for the provider skill dir entry (line 180 catch)
    mocks.lstatSync.mockImplementation((p: string) => {
      if (String(p).includes("bad-entry")) throw new Error("ENOENT");
      return { isSymbolicLink: () => false, isDirectory: () => false };
    });

    const program = new Command();
    registerDoctorCommand(program);

    await program.parseAsync(["node", "test", "doctor", "--json"]);

    const output = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      sections: Array<{ name: string; checks: Array<{ label: string; status: string }> }>;
    };
    const skillsSection = output.sections.find((s) => s.name === "Skills");
    expect(skillsSection).toBeDefined();
    // The unreadable entry is silently skipped; no broken/stale symlinks reported
    const brokenCheck = skillsSection!.checks.find((c) => c.label.includes("No broken symlinks"));
    expect(brokenCheck).toBeDefined();
    expect(brokenCheck!.status).toBe("pass");
  });

  it("handles unreadable provider skill directory", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const providerSkillDir = "/home/user/.claude/skills";

    mocks.detectAllProviders.mockReturnValue([
      {
        installed: true,
        provider: {
          id: "claude-code",
          toolName: "Claude Code",
          pathSkills: providerSkillDir,
          configPathGlobal: "/home/user/.claude/config.json",
          configKey: "mcpServers",
          configFormat: "json",
        },
        methods: ["binary"],
      },
    ]);

    mocks.existsSync.mockReturnValue(true);

    // readdirSync throws for the provider skill dir (line 184 catch)
    mocks.readdirSync.mockImplementation((p: string) => {
      if (String(p).replace(/\\/g, "/").includes(".claude/skills")) throw new Error("EACCES: permission denied");
      return [];
    });

    mocks.lstatSync.mockReturnValue({
      isSymbolicLink: () => false,
      isDirectory: () => false,
    });

    const program = new Command();
    registerDoctorCommand(program);

    await program.parseAsync(["node", "test", "doctor", "--json"]);

    const output = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      sections: Array<{ name: string; checks: Array<{ label: string; status: string }> }>;
    };
    const skillsSection = output.sections.find((s) => s.name === "Skills");
    expect(skillsSection).toBeDefined();
    // The unreadable dir is silently skipped; no broken/stale symlinks reported
    const brokenCheck = skillsSection!.checks.find((c) => c.label.includes("No broken symlinks"));
    expect(brokenCheck).toBeDefined();
    expect(brokenCheck!.status).toBe("pass");
  });

  it("handles lstatSync throw during lock file untracked check", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    mocks.readLockFile.mockResolvedValue({
      version: 1,
      skills: {},
      mcpServers: {},
    });

    // Canonical dir exists
    mocks.existsSync.mockReturnValue(true);

    // readdirSync returns entries for the canonical dir
    mocks.readdirSync.mockReturnValue(["flaky-skill"]);

    // lstatSync throws for the entry in the lock file untracked check (lines 248-249)
    mocks.lstatSync.mockImplementation(() => {
      throw new Error("ENOENT: no such file or directory");
    });

    const program = new Command();
    registerDoctorCommand(program);

    await program.parseAsync(["node", "test", "doctor", "--json"]);

    const output = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      sections: Array<{ name: string; checks: Array<{ label: string; status: string }> }>;
    };
    const lockSection = output.sections.find((s) => s.name === "Lock File");
    expect(lockSection).toBeDefined();
    // The entry is filtered out by the catch, so 0 untracked
    const untrackedCheck = lockSection!.checks.find((c) => c.label.includes("0 untracked"));
    expect(untrackedCheck).toBeDefined();
    expect(untrackedCheck!.status).toBe("pass");
  });

  it("reports lock file read failure with non-Error thrown value", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    mocks.readLockFile.mockRejectedValue("string lock error");

    const program = new Command();
    registerDoctorCommand(program);

    // In --json mode, the command prints JSON and returns (no process.exit)
    await program.parseAsync(["node", "test", "doctor", "--json"]);

    const output = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      sections: Array<{ name: string; checks: Array<{ label: string; status: string; detail?: string }> }>;
      summary: { errors: number };
    };
    const lockSection = output.sections.find((s) => s.name === "Lock File");
    expect(lockSection).toBeDefined();
    const failCheck = lockSection!.checks.find((c) => c.label.includes("Failed to read lock file"));
    expect(failCheck).toBeDefined();
    expect(failCheck!.detail).toBe("string lock error");
    expect(output.summary.errors).toBeGreaterThanOrEqual(1);
  });

  it("reports more than 5 agent-list mismatches with truncation", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const providerSkillDir = "/home/user/.claude/skills";

    mocks.detectAllProviders.mockReturnValue([
      {
        installed: true,
        provider: {
          id: "claude-code",
          toolName: "Claude Code",
          pathSkills: providerSkillDir,
          configPathGlobal: "/home/user/.claude/config.json",
          configKey: "mcpServers",
          configFormat: "json",
        },
        methods: ["binary"],
      },
    ]);

    // Lock file has 7 skills all claiming to be linked to claude-code
    const skills: Record<string, { canonicalPath: string; agents: string[] }> = {};
    for (let i = 1; i <= 7; i++) {
      skills[`skill-${i}`] = {
        canonicalPath: `/home/user/.agents/skills/skill-${i}`,
        agents: ["claude-code"],
      };
    }
    mocks.readLockFile.mockResolvedValue({
      version: 1,
      skills,
      mcpServers: {},
    });

    // All canonical paths exist but NO provider symlinks exist
    mocks.existsSync.mockImplementation((p: string) => {
      const ps = String(p).replace(/\\/g, "/");
      if (ps.includes(".claude/skills")) return false;
      return true;
    });

    mocks.readdirSync.mockReturnValue([]);
    mocks.lstatSync.mockReturnValue({
      isSymbolicLink: () => false,
      isDirectory: () => false,
    });

    const program = new Command();
    registerDoctorCommand(program);

    await program.parseAsync(["node", "test", "doctor", "--json"]);

    const output = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      sections: Array<{ name: string; checks: Array<{ label: string; status: string; detail?: string }> }>;
    };
    const lockSection = output.sections.find((s) => s.name === "Lock File");
    expect(lockSection).toBeDefined();
    const mismatchCheck = lockSection!.checks.find((c) => c.label.includes("agent-list mismatch"));
    expect(mismatchCheck).toBeDefined();
    expect(mismatchCheck!.status).toBe("warn");
    expect(mismatchCheck!.label).toContain("7");
    // Should show truncation indicator
    expect(mismatchCheck!.detail).toContain("+2 more");
  });

  it("reports config parse error with non-Error thrown value", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    mocks.detectAllProviders.mockReturnValue([
      {
        installed: true,
        provider: {
          id: "claude-code",
          toolName: "Claude Code",
          pathSkills: "/home/user/.claude/skills",
          configPathGlobal: "/home/user/.claude/config.json",
          configKey: "mcpServers",
          configFormat: "json",
        },
        methods: ["binary"],
      },
    ]);

    mocks.existsSync.mockReturnValue(true);
    mocks.readdirSync.mockReturnValue([]);
    mocks.lstatSync.mockReturnValue({
      isSymbolicLink: () => false,
      isDirectory: () => false,
    });

    // readConfig rejects with a non-Error value (covers String(err) branch)
    mocks.readConfig.mockRejectedValue("raw string error");

    const program = new Command();
    registerDoctorCommand(program);

    await program.parseAsync(["node", "test", "doctor", "--json"]);

    const output = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0] ?? "{}")) as {
      sections: Array<{ name: string; checks: Array<{ label: string; status: string; detail?: string }> }>;
    };
    const configSection = output.sections.find((s) => s.name === "Config Files");
    expect(configSection).toBeDefined();
    const parseErrorCheck = configSection!.checks.find((c) => c.label.includes("config parse error"));
    expect(parseErrorCheck).toBeDefined();
    expect(parseErrorCheck!.detail).toBe("raw string error");
  });

  it("human output with exactly 1 warning and 1 error uses singular forms", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Create exactly 1 error: malformed provider entry
    mocks.getAllProviders.mockReturnValue([
      { id: "bad", toolName: "", configKey: "", configFormat: "" },
    ]);

    // Create exactly 1 warning: orphaned lock entry
    mocks.readLockFile.mockResolvedValue({
      version: 1,
      skills: {
        "gone-skill": {
          canonicalPath: "/nonexistent/gone-skill",
          agents: [],
        },
      },
      mcpServers: {},
    });
    // existsSync false by default -> orphaned warning

    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process-exit");
    }) as never);

    const program = new Command();
    registerDoctorCommand(program);

    await expect(program.parseAsync(["node", "test", "doctor"])).rejects.toThrow("process-exit");

    const allOutput = logSpy.mock.calls.map((c) => String(c[0])).join("\n");

    // Check singular forms in summary
    expect(allOutput).toContain("1 warning");
    expect(allOutput).toContain("1 error");
    // Should NOT contain plural "warnings" or "errors" in summary
    // (but "warnings" may appear elsewhere, so just check the Summary line)
    const summaryLine = logSpy.mock.calls
      .map((c) => String(c[0]))
      .find((line) => line.includes("Summary"));
    expect(summaryLine).toBeDefined();
    expect(summaryLine).not.toContain("warnings");
    expect(summaryLine).not.toContain("errors");

    exitSpy.mockRestore();
  });

  it("handles human output with warnings in summary line", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Set up an orphaned lock entry to produce a warning (but no errors)
    mocks.readLockFile.mockResolvedValue({
      version: 1,
      skills: {
        "gone-skill": {
          canonicalPath: "/nonexistent/gone-skill",
          agents: [],
        },
      },
      mcpServers: {},
    });
    // existsSync false by default, so canonicalPath check fails -> orphaned warning

    const program = new Command();
    registerDoctorCommand(program);

    await program.parseAsync(["node", "test", "doctor"]);

    const allOutput = logSpy.mock.calls.map((c) => String(c[0])).join("\n");

    // Summary line should contain warning count
    expect(allOutput).toContain("warning");
    expect(allOutput).toContain("checks passed");
  });
});
