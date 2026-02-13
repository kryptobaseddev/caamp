import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Provider } from "../../src/types.js";
import {
  applyMcpInstallWithPolicy,
  configureProviderGlobalAndProject,
  detectMcpConfigConflicts,
  installBatchWithRollback,
  selectProvidersByMinimumPriority,
  updateInstructionsSingleOperation,
} from "../../src/core/advanced/orchestration.js";

let testDir: string;

function makeProvider(id: string, overrides: Partial<Provider> = {}): Provider {
  return {
    id,
    toolName: id,
    vendor: "test",
    agentFlag: id,
    aliases: [],
    pathGlobal: join(testDir, "global", id),
    pathProject: ".",
    instructFile: "AGENTS.md",
    configKey: "mcpServers",
    configFormat: "json",
    configPathGlobal: join(testDir, "global", id, "config.json"),
    configPathProject: `.config/${id}.json`,
    pathSkills: join(testDir, "skills", id, "global"),
    pathProjectSkills: `.skills/${id}`,
    detection: { methods: ["binary"], binary: id },
    supportedTransports: ["stdio", "http", "sse"],
    supportsHeaders: true,
    priority: "medium",
    status: "active",
    agentSkillsCompatible: true,
    ...overrides,
  };
}

beforeEach(async () => {
  testDir = join(tmpdir(), `caamp-advanced-test-${Date.now()}`);
  await mkdir(testDir, { recursive: true });
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true }).catch(() => {});
});

describe("selectProvidersByMinimumPriority", () => {
  it("filters and sorts by priority", () => {
    const providers = [
      makeProvider("low-1", { priority: "low" }),
      makeProvider("high-1", { priority: "high" }),
      makeProvider("medium-1", { priority: "medium" }),
    ];

    const result = selectProvidersByMinimumPriority(providers, "medium");
    expect(result.map((provider) => provider.id)).toEqual(["high-1", "medium-1"]);
  });
});

describe("installBatchWithRollback", () => {
  it("restores config files when a provider fails during MCP install", async () => {
    const ok = makeProvider("ok", {
      priority: "high",
      configPathProject: ".ok/config.json",
    });
    const failing = makeProvider("failing", {
      priority: "medium",
      configPathProject: null,
    });

    const result = await installBatchWithRollback({
      providers: [ok, failing],
      minimumPriority: "medium",
      mcp: [{
        serverName: "test-server",
        config: { command: "npx", args: ["-y", "@example/test-server"] },
        scope: "project",
      }],
      projectDir: testDir,
    });

    const writtenPath = join(testDir, ".ok/config.json");

    expect(result.success).toBe(false);
    expect(result.rollbackPerformed).toBe(true);
    expect(result.mcpApplied).toBe(1);
    expect(existsSync(writtenPath)).toBe(false);
  });
});

describe("detectMcpConfigConflicts + applyMcpInstallWithPolicy", () => {
  it("detects transport/header conflicts and can skip conflicting writes", async () => {
    const provider = makeProvider("conflict-agent", {
      supportedTransports: ["stdio"],
      supportsHeaders: false,
    });

    await mkdir(join(testDir, "global", "conflict-agent"), { recursive: true });
    await writeFile(provider.configPathGlobal, JSON.stringify({
      mcpServers: {
        existing: { command: "old-command" },
      },
    }, null, 2));

    const operations = [
      {
        serverName: "remote",
        config: {
          type: "http" as const,
          url: "https://example.com/mcp",
          headers: { authorization: "Bearer test" },
        },
        scope: "global" as const,
      },
      {
        serverName: "existing",
        config: { command: "new-command" },
        scope: "global" as const,
      },
    ];

    const conflicts = await detectMcpConfigConflicts([provider], operations, testDir);
    expect(conflicts.some((conflict) => conflict.code === "unsupported-transport")).toBe(true);
    expect(conflicts.some((conflict) => conflict.code === "unsupported-headers")).toBe(true);
    expect(conflicts.some((conflict) => conflict.code === "existing-mismatch")).toBe(true);

    const applied = await applyMcpInstallWithPolicy([provider], operations, "skip", testDir);
    expect(applied.applied).toHaveLength(0);
    expect(applied.skipped.length).toBeGreaterThan(0);
  });
});

describe("updateInstructionsSingleOperation", () => {
  it("updates one shared file and reports provider/config-format coverage", async () => {
    const p1 = makeProvider("p1", { configFormat: "json", instructFile: "AGENTS.md" });
    const p2 = makeProvider("p2", { configFormat: "yaml", instructFile: "AGENTS.md" });

    const result = await updateInstructionsSingleOperation(
      [p1, p2],
      "Shared block content",
      "project",
      testDir,
    );

    expect(result.updatedFiles).toBe(1);
    expect(result.actions[0]?.providers.sort()).toEqual(["p1", "p2"]);
    expect(result.actions[0]?.configFormats.sort()).toEqual(["json", "yaml"]);
  });
});

describe("configureProviderGlobalAndProject", () => {
  it("writes global + project MCP configs and injects instructions in one call", async () => {
    const provider = makeProvider("dual", {
      configPathProject: ".dual/config.json",
      instructFile: "CLAUDE.md",
    });

    const result = await configureProviderGlobalAndProject(provider, {
      globalMcp: [{ serverName: "global-srv", config: { command: "global" } }],
      projectMcp: [{ serverName: "project-srv", config: { command: "project" } }],
      instructionContent: "Unified instruction content",
      projectDir: testDir,
    });

    expect(result.mcp.global[0]?.success).toBe(true);
    expect(result.mcp.project[0]?.success).toBe(true);

    const globalInstructionPath = join(provider.pathGlobal, provider.instructFile);
    const projectInstructionPath = join(testDir, provider.instructFile);
    expect(existsSync(globalInstructionPath)).toBe(true);
    expect(existsSync(projectInstructionPath)).toBe(true);
  });
});
