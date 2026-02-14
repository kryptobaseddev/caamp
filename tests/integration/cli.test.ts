import { Command } from "commander";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerProvidersCommand } from "../../src/commands/providers.js";

describe("integration: cli command behavior", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parseable json for providers list --json", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const program = new Command();
    registerProvidersCommand(program);

    await program.parseAsync(["node", "test", "providers", "list", "--json"]);

    const output = String(logSpy.mock.calls[0]?.[0] ?? "[]");
    const parsed = JSON.parse(output) as Array<{ id: string }>;
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed[0]?.id).toBeTypeOf("string");
  });

  it("returns parseable json for providers show --json", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const program = new Command();
    registerProvidersCommand(program);

    await program.parseAsync(["node", "test", "providers", "show", "claude-code", "--json"]);

    const output = String(logSpy.mock.calls[0]?.[0] ?? "{}");
    const parsed = JSON.parse(output) as { id: string; toolName: string };
    expect(parsed.id).toBe("claude-code");
    expect(parsed.toolName).toBeTypeOf("string");
  });

  it("exits non-zero for unknown provider on show", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process-exit");
    }) as never);
    const program = new Command();
    registerProvidersCommand(program);

    await expect(program.parseAsync(["node", "test", "providers", "show", "unknown-provider"])).rejects.toThrow("process-exit");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
