import { Command } from "commander";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getProvider: vi.fn(),
  getAllProviders: vi.fn(),
  getProviderCount: vi.fn(),
  getRegistryVersion: vi.fn(),
  getProvidersByPriority: vi.fn(),
  detectAllProviders: vi.fn(),
  detectProjectProviders: vi.fn(),
  existsSync: vi.fn(),
  readConfig: vi.fn(),
  resolveProviderConfigPath: vi.fn(),
}));

vi.mock("../../src/core/registry/providers.js", () => ({
  getProvider: mocks.getProvider,
  getAllProviders: mocks.getAllProviders,
  getProviderCount: mocks.getProviderCount,
  getRegistryVersion: mocks.getRegistryVersion,
  getProvidersByPriority: mocks.getProvidersByPriority,
}));

vi.mock("../../src/core/registry/detection.js", () => ({
  detectAllProviders: mocks.detectAllProviders,
  detectProjectProviders: mocks.detectProjectProviders,
}));

vi.mock("node:fs", () => ({
  existsSync: mocks.existsSync,
}));

vi.mock("../../src/core/formats/index.js", () => ({
  readConfig: mocks.readConfig,
}));

vi.mock("../../src/core/paths/standard.js", () => ({
  resolveProviderConfigPath: mocks.resolveProviderConfigPath,
}));

import { registerConfigCommand } from "../../src/commands/config.js";
import { registerProvidersCommand } from "../../src/commands/providers.js";

const provider = {
  id: "claude-code",
  aliases: ["claude"],
  toolName: "Claude Code",
  vendor: "Anthropic",
  agentFlag: "claude",
  status: "active",
  priority: "high",
  instructFile: "CLAUDE.md",
  configFormat: "json",
  configKey: "mcpServers",
  supportedTransports: ["stdio", "http"],
  supportsHeaders: true,
  pathGlobal: "/home/user/.claude",
  pathProject: ".claude",
  configPathGlobal: "/home/user/.claude/settings.json",
  configPathProject: "/repo/.claude/settings.json",
  pathSkills: "/home/user/.claude/skills",
  pathProjectSkills: "/repo/.claude/skills",
};

describe("integration: config + providers commands", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.getProvider.mockReset();
    mocks.getAllProviders.mockReset();
    mocks.getProviderCount.mockReset();
    mocks.getRegistryVersion.mockReset();
    mocks.getProvidersByPriority.mockReset();
    mocks.detectAllProviders.mockReset();
    mocks.detectProjectProviders.mockReset();
    mocks.existsSync.mockReset();
    mocks.readConfig.mockReset();
    mocks.resolveProviderConfigPath.mockReset();

    mocks.getProvider.mockImplementation((id: string) => (id === "claude-code" || id === "claude" ? provider : undefined));
    mocks.getAllProviders.mockReturnValue([provider]);
    mocks.getProviderCount.mockReturnValue(1);
    mocks.getRegistryVersion.mockReturnValue("1.0.0");
    mocks.getProvidersByPriority.mockReturnValue([provider]);
    mocks.detectAllProviders.mockReturnValue([
      { provider, installed: true, methods: ["binary"], projectDetected: false },
      { provider: { ...provider, id: "cursor" }, installed: false, methods: [], projectDetected: false },
    ]);
    mocks.detectProjectProviders.mockReturnValue([
      { provider, installed: true, methods: ["config"], projectDetected: true },
    ]);
    mocks.resolveProviderConfigPath.mockReturnValue("/repo/.claude/settings.json");
    mocks.existsSync.mockReturnValue(true);
    mocks.readConfig.mockResolvedValue({ mcpServers: { filesystem: { command: "npx" } } });
  });

  it("shows config as json", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const program = new Command();
    registerConfigCommand(program);

    await program.parseAsync(["node", "test", "config", "show", "claude-code", "--json"]);

    expect(mocks.resolveProviderConfigPath).toHaveBeenCalledWith(provider, "project");
    expect(mocks.readConfig).toHaveBeenCalledWith("/repo/.claude/settings.json", "json");
    expect(JSON.parse(String(logSpy.mock.calls[0]?.[0] ?? "{}"))).toEqual({
      mcpServers: { filesystem: { command: "npx" } },
    });
  });

  it("prints no-config message when config path is missing", async () => {
    mocks.existsSync.mockReturnValue(false);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const program = new Command();
    registerConfigCommand(program);

    await program.parseAsync(["node", "test", "config", "show", "claude-code"]);

    expect(mocks.readConfig).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("No config file at:"));
  });

  it("exits config show for unknown provider", async () => {
    mocks.getProvider.mockReturnValue(undefined);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process-exit");
    }) as never);

    const program = new Command();
    registerConfigCommand(program);

    await expect(program.parseAsync(["node", "test", "config", "show", "ghost"])).rejects.toThrow("process-exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("returns fallback global path when provider lacks project config", async () => {
    mocks.resolveProviderConfigPath.mockReturnValue(null);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const program = new Command();
    registerConfigCommand(program);

    await program.parseAsync(["node", "test", "config", "path", "claude-code"]);

    expect(logSpy.mock.calls.map((call) => String(call[0] ?? ""))).toContain("/home/user/.claude/settings.json");
  });

  it("lists providers in json with tier filtering", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const program = new Command();
    registerProvidersCommand(program);

    await program.parseAsync(["node", "test", "providers", "list", "--tier", "high", "--json"]);

    expect(mocks.getProvidersByPriority).toHaveBeenCalledWith("high");
    expect(JSON.parse(String(logSpy.mock.calls[0]?.[0] ?? "[]"))).toEqual([provider]);
  });

  it("detects project providers and emits json", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const program = new Command();
    registerProvidersCommand(program);

    await program.parseAsync(["node", "test", "providers", "detect", "--project", "--json"]);

    expect(mocks.detectProjectProviders).toHaveBeenCalledWith(process.cwd());
    expect(JSON.parse(String(logSpy.mock.calls[0]?.[0] ?? "[]"))).toEqual([
      {
        id: "claude-code",
        toolName: "Claude Code",
        methods: ["config"],
        projectDetected: true,
      },
    ]);
  });

  it("shows provider details and exits on unknown provider", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const programSuccess = new Command();
    registerProvidersCommand(programSuccess);

    await programSuccess.parseAsync(["node", "test", "providers", "show", "claude-code"]);
    const lines = logSpy.mock.calls.map((call) => String(call[0] ?? ""));
    expect(lines.some((line) => line.includes("Claude Code"))).toBe(true);
    expect(lines.some((line) => line.includes("Aliases:"))).toBe(true);

    mocks.getProvider.mockReturnValue(undefined);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process-exit");
    }) as never);

    const programFailure = new Command();
    registerProvidersCommand(programFailure);

    await expect(programFailure.parseAsync(["node", "test", "providers", "show", "ghost"])).rejects.toThrow(
      "process-exit",
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
