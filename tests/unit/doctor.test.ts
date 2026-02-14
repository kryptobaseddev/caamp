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
  getCaampVersion: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFileSync: mocks.execFileSync,
}));

vi.mock("node:fs", () => ({
  existsSync: mocks.existsSync,
  readdirSync: mocks.readdirSync,
  lstatSync: mocks.lstatSync,
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
});
