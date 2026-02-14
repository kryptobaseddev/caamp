import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  parseSource: vi.fn(),
  installMcpServerToAll: vi.fn(),
  buildServerConfig: vi.fn(),
  recordMcpInstall: vi.fn(),
  getInstalledProviders: vi.fn(),
  getProvider: vi.fn(),
}));

vi.mock("../../src/core/sources/parser.js", () => ({
  parseSource: mocks.parseSource,
}));

vi.mock("../../src/core/mcp/installer.js", () => ({
  installMcpServerToAll: mocks.installMcpServerToAll,
  buildServerConfig: mocks.buildServerConfig,
}));

vi.mock("../../src/core/mcp/lock.js", () => ({
  recordMcpInstall: mocks.recordMcpInstall,
}));

vi.mock("../../src/core/registry/detection.js", () => ({
  getInstalledProviders: mocks.getInstalledProviders,
}));

vi.mock("../../src/core/registry/providers.js", () => ({
  getProvider: mocks.getProvider,
}));

import { registerMcpInstall } from "../../src/commands/mcp/install.js";

const provider = {
  id: "claude-code",
  toolName: "Claude Code",
};

describe("integration: mcp install command", () => {
  beforeEach(() => {
    mocks.parseSource.mockReset();
    mocks.installMcpServerToAll.mockReset();
    mocks.buildServerConfig.mockReset();
    mocks.recordMcpInstall.mockReset();
    mocks.getInstalledProviders.mockReset();
    mocks.getProvider.mockReset();

    mocks.parseSource.mockReturnValue({ type: "package", value: "@acme/mcp", inferredName: "acme" });
    mocks.buildServerConfig.mockReturnValue({ command: "npx", args: ["-y", "@acme/mcp"] });
    mocks.getInstalledProviders.mockReturnValue([provider]);
    mocks.installMcpServerToAll.mockResolvedValue([
      { provider, success: true, scope: "project", configPath: "/tmp/config.json" },
    ]);
    mocks.recordMcpInstall.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs dry-run without writing configs", async () => {
    const program = new Command();
    registerMcpInstall(program);

    await program.parseAsync(["node", "test", "install", "@acme/mcp", "--all", "--dry-run"]);

    expect(mocks.installMcpServerToAll).not.toHaveBeenCalled();
    expect(mocks.recordMcpInstall).not.toHaveBeenCalled();
  });

  it("installs MCP config and records lock for successful providers", async () => {
    const program = new Command();
    registerMcpInstall(program);

    await program.parseAsync(["node", "test", "install", "@acme/mcp", "--all"]);

    expect(mocks.installMcpServerToAll).toHaveBeenCalled();
    expect(mocks.recordMcpInstall).toHaveBeenCalledWith(
      "acme",
      "@acme/mcp",
      "package",
      ["claude-code"],
      false,
    );
  });

  it("exits when no target providers are available", async () => {
    mocks.getInstalledProviders.mockReturnValue([]);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process-exit");
    }) as never);

    const program = new Command();
    registerMcpInstall(program);

    await expect(program.parseAsync(["node", "test", "install", "@acme/mcp", "--all"])).rejects.toThrow("process-exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
