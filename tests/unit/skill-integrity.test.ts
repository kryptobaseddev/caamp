import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFile, rm, mkdir, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  isCaampOwnedSkill,
  shouldOverrideSkill,
  checkSkillIntegrity,
  checkAllSkillIntegrity,
} from "../../src/core/skills/integrity.js";
import type { LockEntry, Provider } from "../../src/types.js";

let testDir: string;

beforeEach(async () => {
  testDir = join(tmpdir(), `caamp-integrity-test-${Date.now()}`);
  await mkdir(testDir, { recursive: true });
});

afterEach(async () => {
  await rm(testDir, { recursive: true }).catch(() => {});
});

// ── isCaampOwnedSkill ───────────────────────────────────────────────

describe("isCaampOwnedSkill()", () => {
  it("returns true for ct-* prefixed skills", () => {
    expect(isCaampOwnedSkill("ct-orchestrator")).toBe(true);
    expect(isCaampOwnedSkill("ct-dev-workflow")).toBe(true);
    expect(isCaampOwnedSkill("ct-cleo")).toBe(true);
  });

  it("returns false for non-ct-* skills", () => {
    expect(isCaampOwnedSkill("my-skill")).toBe(false);
    expect(isCaampOwnedSkill("orchestrator")).toBe(false);
    expect(isCaampOwnedSkill("act-something")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isCaampOwnedSkill("")).toBe(false);
  });
});

// ── shouldOverrideSkill ─────────────────────────────────────────────

describe("shouldOverrideSkill()", () => {
  it("returns true when no existing entry", () => {
    expect(shouldOverrideSkill("my-skill", "github:owner/repo", undefined)).toBe(true);
  });

  it("returns true for ct-* skills (CAAMP always wins)", () => {
    const existing: LockEntry = {
      name: "ct-orchestrator",
      scopedName: "ct-orchestrator",
      source: "user/custom-repo",
      sourceType: "github",
      installedAt: new Date().toISOString(),
      agents: ["claude-code"],
      canonicalPath: "/fake/path",
      isGlobal: true,
    };

    expect(shouldOverrideSkill("ct-orchestrator", "@cleocode/skills", existing)).toBe(true);
  });

  it("returns true for non-ct-* skills (user can override)", () => {
    const existing: LockEntry = {
      name: "my-skill",
      scopedName: "my-skill",
      source: "other/repo",
      sourceType: "github",
      installedAt: new Date().toISOString(),
      agents: ["claude-code"],
      canonicalPath: "/fake/path",
      isGlobal: true,
    };

    expect(shouldOverrideSkill("my-skill", "new/source", existing)).toBe(true);
  });
});

// ── checkSkillIntegrity ─────────────────────────────────────────────

describe("checkSkillIntegrity()", () => {
  it("returns 'not-tracked' for skills not in lock file", async () => {
    // Mock readLockFile to return empty lock
    vi.doMock("../../src/core/lock-utils.js", () => ({
      readLockFile: vi.fn().mockResolvedValue({
        version: 1,
        skills: {},
        mcpServers: {},
      }),
      updateLockFile: vi.fn(),
    }));

    // Re-import to pick up mock
    const { checkSkillIntegrity: check } = await import("../../src/core/skills/integrity.js");

    const result = await check("unknown-skill", []);
    expect(result.status).toBe("not-tracked");
    expect(result.issue).toContain("not tracked");

    vi.doUnmock("../../src/core/lock-utils.js");
  });

  it("identifies ct-* skills as CAAMP-owned", async () => {
    vi.doMock("../../src/core/lock-utils.js", () => ({
      readLockFile: vi.fn().mockResolvedValue({
        version: 1,
        skills: {},
        mcpServers: {},
      }),
      updateLockFile: vi.fn(),
    }));

    const { checkSkillIntegrity: check } = await import("../../src/core/skills/integrity.js");

    const result = await check("ct-orchestrator", []);
    expect(result.isCaampOwned).toBe(true);

    const result2 = await check("my-custom-skill", []);
    expect(result2.isCaampOwned).toBe(false);

    vi.doUnmock("../../src/core/lock-utils.js");
  });
});

// ── validateInstructionIntegrity ─────────────────────────────────────

describe("validateInstructionIntegrity()", () => {
  it("reports missing instruction files", async () => {
    const { validateInstructionIntegrity } = await import("../../src/core/skills/integrity.js");

    const providers = [
      {
        id: "test-provider",
        instructFile: "NONEXISTENT.md",
        pathGlobal: testDir,
      } as Provider,
    ];

    const issues = await validateInstructionIntegrity(providers, testDir, "project");
    expect(issues.length).toBe(1);
    expect(issues[0]?.issue).toContain("does not exist");
  });

  it("reports files without CAAMP blocks", async () => {
    const { validateInstructionIntegrity } = await import("../../src/core/skills/integrity.js");

    await writeFile(join(testDir, "PLAIN.md"), "# Just a file\nNo markers here.\n");

    const providers = [
      {
        id: "test-provider",
        instructFile: "PLAIN.md",
        pathGlobal: testDir,
      } as Provider,
    ];

    const issues = await validateInstructionIntegrity(providers, testDir, "project");
    expect(issues.length).toBe(1);
    expect(issues[0]?.issue).toContain("No CAAMP injection block");
  });

  it("reports no issues for current files", async () => {
    const { validateInstructionIntegrity } = await import("../../src/core/skills/integrity.js");

    await writeFile(
      join(testDir, "GOOD.md"),
      "<!-- CAAMP:START -->\n@AGENTS.md\n<!-- CAAMP:END -->\n",
    );

    const providers = [
      {
        id: "test-provider",
        instructFile: "GOOD.md",
        pathGlobal: testDir,
      } as Provider,
    ];

    const issues = await validateInstructionIntegrity(providers, testDir, "project");
    expect(issues.length).toBe(0);
  });

  it("reports outdated files when expected content differs", async () => {
    const { validateInstructionIntegrity } = await import("../../src/core/skills/integrity.js");

    await writeFile(
      join(testDir, "OLD.md"),
      "<!-- CAAMP:START -->\nold content\n<!-- CAAMP:END -->\n",
    );

    const providers = [
      {
        id: "test-provider",
        instructFile: "OLD.md",
        pathGlobal: testDir,
      } as Provider,
    ];

    const issues = await validateInstructionIntegrity(
      providers,
      testDir,
      "project",
      "new content",
    );
    expect(issues.length).toBe(1);
    expect(issues[0]?.issue).toContain("outdated");
  });
});
