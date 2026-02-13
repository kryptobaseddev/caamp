import { beforeEach, describe, expect, it } from "vitest";
import {
  getAllProviders,
  getInstructionFiles,
  getProvider,
  getProviderCount,
  getProvidersByInstructFile,
  getProvidersByPriority,
  getProvidersByStatus,
  getRegistryVersion,
  resetRegistry,
  resolveAlias,
} from "../../src/core/registry/providers.js";

beforeEach(() => {
  resetRegistry();
});

describe("Provider Registry", () => {
  it("loads all providers from registry.json", () => {
    const providers = getAllProviders();
    expect(providers.length).toBeGreaterThanOrEqual(25);
  });

  it("returns correct provider count", () => {
    expect(getProviderCount()).toBeGreaterThanOrEqual(25);
  });

  it("returns registry version", () => {
    expect(getRegistryVersion()).toBe("1.0.0");
  });

  it("gets provider by ID", () => {
    const claude = getProvider("claude-code");
    expect(claude).toBeDefined();
    expect(claude?.toolName).toBe("Claude Code");
    expect(claude?.vendor).toBe("Anthropic");
    expect(claude?.instructFile).toBe("CLAUDE.md");
  });

  it("gets provider by alias", () => {
    const claude = getProvider("claude");
    expect(claude).toBeDefined();
    expect(claude?.id).toBe("claude-code");
  });

  it("resolves aliases", () => {
    expect(resolveAlias("claude")).toBe("claude-code");
    expect(resolveAlias("gemini")).toBe("gemini-cli");
    expect(resolveAlias("copilot")).toBe("github-copilot");
    expect(resolveAlias("unknown")).toBe("unknown");
  });

  it("returns undefined for unknown provider", () => {
    expect(getProvider("nonexistent")).toBeUndefined();
  });

  it("filters by priority", () => {
    const high = getProvidersByPriority("high");
    expect(high.length).toBeGreaterThanOrEqual(3);
    expect(high.every((p) => p.priority === "high")).toBe(true);
    expect(high.some((p) => p.id === "claude-code")).toBe(true);
    expect(high.some((p) => p.id === "cursor")).toBe(true);
    expect(high.some((p) => p.id === "windsurf")).toBe(true);
  });

  it("filters by status", () => {
    const active = getProvidersByStatus("active");
    expect(active.length).toBeGreaterThan(0);
    expect(active.every((p) => p.status === "active")).toBe(true);
  });

  it("filters by instruction file", () => {
    const claude = getProvidersByInstructFile("CLAUDE.md");
    expect(claude.some((p) => p.id === "claude-code")).toBe(true);

    const agents = getProvidersByInstructFile("AGENTS.md");
    expect(agents.length).toBeGreaterThan(5);
    expect(agents.some((p) => p.id === "cursor")).toBe(true);
    expect(agents.some((p) => p.id === "codex")).toBe(true);
    expect(agents.some((p) => p.id === "kimi")).toBe(true);

    const gemini = getProvidersByInstructFile("GEMINI.md");
    expect(gemini.some((p) => p.id === "gemini-cli")).toBe(true);
  });

  it("returns unique instruction files", () => {
    const files = getInstructionFiles();
    expect(files).toContain("CLAUDE.md");
    expect(files).toContain("AGENTS.md");
    expect(files).toContain("GEMINI.md");
    // No CODEX.md or KIMI.md - they use AGENTS.md
    expect(files).not.toContain("CODEX.md");
    expect(files).not.toContain("KIMI.md");
  });

  it("resolves platform-specific paths", () => {
    const claude = getProvider("claude-code");
    expect(claude).toBeDefined();
    expect(claude?.pathGlobal).not.toContain("$HOME");
    expect(claude?.configPathGlobal).not.toContain("$HOME");
    expect(claude?.pathSkills).not.toContain("$HOME");
  });

  it("has correct config keys per provider", () => {
    expect(getProvider("claude-code")?.configKey).toBe("mcpServers");
    expect(getProvider("codex")?.configKey).toBe("mcp_servers");
    expect(getProvider("goose")?.configKey).toBe("extensions");
    expect(getProvider("opencode")?.configKey).toBe("mcp");
    expect(getProvider("vscode")?.configKey).toBe("servers");
    expect(getProvider("zed")?.configKey).toBe("context_servers");
  });

  it("has correct config formats per provider", () => {
    expect(getProvider("claude-code")?.configFormat).toBe("json");
    expect(getProvider("goose")?.configFormat).toBe("yaml");
    expect(getProvider("codex")?.configFormat).toBe("toml");
    expect(getProvider("zed")?.configFormat).toBe("jsonc");
  });
});
