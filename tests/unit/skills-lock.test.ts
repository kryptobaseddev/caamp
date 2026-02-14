import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CaampLockFile } from "../../src/types.js";

const mocks = vi.hoisted(() => ({
  readLockFile: vi.fn(),
  updateLockFile: vi.fn(),
  parseSource: vi.fn(),
  listRemote: vi.fn(),
}));

vi.mock("../../src/core/lock-utils.js", () => ({
  readLockFile: mocks.readLockFile,
  updateLockFile: mocks.updateLockFile,
}));

vi.mock("../../src/core/sources/parser.js", () => ({
  parseSource: mocks.parseSource,
}));

vi.mock("simple-git", () => ({
  simpleGit: () => ({
    listRemote: mocks.listRemote,
  }),
}));

import {
  checkSkillUpdate,
  getTrackedSkills,
  recordSkillInstall,
  removeSkillFromLock,
} from "../../src/core/skills/lock.js";

function createLock(overrides: Partial<CaampLockFile> = {}): CaampLockFile {
  return {
    version: 1,
    skills: {},
    mcpServers: {},
    ...overrides,
  };
}

describe("skills lock", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-01T12:00:00.000Z"));
    mocks.readLockFile.mockReset();
    mocks.updateLockFile.mockReset();
    mocks.parseSource.mockReset();
    mocks.listRemote.mockReset();
  });

  it("records a new skill install entry", async () => {
    const lock = createLock();
    mocks.updateLockFile.mockImplementation(async (updater: (draft: CaampLockFile) => void) => {
      updater(lock);
    });

    await recordSkillInstall(
      "docs-helper",
      "@demo/docs-helper",
      "demo/docs-helper",
      "github",
      ["claude-code"],
      "/tmp/skills/docs-helper",
      true,
    );

    expect(lock.skills["docs-helper"]).toEqual({
      name: "docs-helper",
      scopedName: "@demo/docs-helper",
      source: "demo/docs-helper",
      sourceType: "github",
      version: undefined,
      installedAt: "2026-02-01T12:00:00.000Z",
      updatedAt: "2026-02-01T12:00:00.000Z",
      agents: ["claude-code"],
      canonicalPath: "/tmp/skills/docs-helper",
      isGlobal: true,
      projectDir: undefined,
    });
  });

  it("preserves first install metadata and merges agents", async () => {
    const lock = createLock({
      skills: {
        "docs-helper": {
          name: "docs-helper",
          scopedName: "@demo/docs-helper",
          source: "demo/docs-helper",
          sourceType: "github",
          version: "abc1234",
          installedAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-10T00:00:00.000Z",
          agents: ["claude-code"],
          canonicalPath: "/tmp/skills/docs-helper",
          isGlobal: true,
          projectDir: "/repo-a",
        },
      },
    });
    mocks.updateLockFile.mockImplementation(async (updater: (draft: CaampLockFile) => void) => {
      updater(lock);
    });

    await recordSkillInstall(
      "docs-helper",
      "@ignored/new",
      "ignored/new",
      "gitlab",
      ["claude-code", "cursor"],
      "/tmp/skills/docs-helper-new",
      false,
      "/repo-b",
      "def5678",
    );

    expect(lock.skills["docs-helper"]?.scopedName).toBe("@demo/docs-helper");
    expect(lock.skills["docs-helper"]?.sourceType).toBe("github");
    expect(lock.skills["docs-helper"]?.installedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(lock.skills["docs-helper"]?.updatedAt).toBe("2026-02-01T12:00:00.000Z");
    expect(lock.skills["docs-helper"]?.agents).toEqual(["claude-code", "cursor"]);
    expect(lock.skills["docs-helper"]?.isGlobal).toBe(true);
    expect(lock.skills["docs-helper"]?.projectDir).toBe("/repo-a");
    expect(lock.skills["docs-helper"]?.version).toBe("def5678");
  });

  it("removes skill entries and reports missing entries", async () => {
    const lock = createLock({
      skills: {
        alpha: {
          name: "alpha",
          scopedName: "alpha",
          source: "owner/alpha",
          sourceType: "github",
          installedAt: "2026-01-01T00:00:00.000Z",
          agents: ["claude-code"],
          canonicalPath: "/tmp/alpha",
          isGlobal: true,
        },
      },
    });
    mocks.updateLockFile.mockImplementation(async (updater: (draft: CaampLockFile) => void) => {
      updater(lock);
    });

    await expect(removeSkillFromLock("alpha")).resolves.toBe(true);
    await expect(removeSkillFromLock("missing")).resolves.toBe(false);
  });

  it("returns tracked skills", async () => {
    mocks.readLockFile.mockResolvedValue(createLock({
      skills: {
        alpha: {
          name: "alpha",
          scopedName: "alpha",
          source: "owner/alpha",
          sourceType: "github",
          installedAt: "2026-01-01T00:00:00.000Z",
          agents: ["claude-code"],
          canonicalPath: "/tmp/alpha",
          isGlobal: true,
        },
      },
    }));

    const skills = await getTrackedSkills();
    expect(Object.keys(skills)).toEqual(["alpha"]);
  });

  it("reports unknown when skill is missing or source is unsupported", async () => {
    mocks.readLockFile.mockResolvedValueOnce(createLock());

    await expect(checkSkillUpdate("ghost")).resolves.toEqual({ hasUpdate: false, status: "unknown" });

    mocks.readLockFile.mockResolvedValueOnce(createLock({
      skills: {
        local: {
          name: "local",
          scopedName: "local",
          source: "./local",
          sourceType: "local",
          version: "abc",
          installedAt: "2026-01-01T00:00:00.000Z",
          agents: ["claude-code"],
          canonicalPath: "/tmp/local",
          isGlobal: false,
        },
      },
    }));

    await expect(checkSkillUpdate("local")).resolves.toEqual({
      hasUpdate: false,
      currentVersion: "abc",
      status: "unknown",
    });
  });

  it("reports unknown when source parsing or remote lookup fails", async () => {
    mocks.readLockFile.mockResolvedValue(createLock({
      skills: {
        alpha: {
          name: "alpha",
          scopedName: "alpha",
          source: "owner/alpha",
          sourceType: "github",
          version: "abc1234",
          installedAt: "2026-01-01T00:00:00.000Z",
          agents: ["claude-code"],
          canonicalPath: "/tmp/alpha",
          isGlobal: true,
        },
      },
    }));

    mocks.parseSource.mockReturnValueOnce({ type: "github" });
    await expect(checkSkillUpdate("alpha")).resolves.toEqual({
      hasUpdate: false,
      currentVersion: "abc1234",
      status: "unknown",
    });

    mocks.parseSource.mockReturnValueOnce({ type: "github", owner: "owner", repo: "alpha", ref: "main" });
    mocks.listRemote.mockResolvedValueOnce("");
    await expect(checkSkillUpdate("alpha")).resolves.toEqual({
      hasUpdate: false,
      currentVersion: "abc1234",
      status: "unknown",
    });
  });

  it("reports update state from remote commit sha", async () => {
    mocks.readLockFile.mockResolvedValue(createLock({
      skills: {
        alpha: {
          name: "alpha",
          scopedName: "alpha",
          source: "owner/alpha",
          sourceType: "github",
          version: "abc1234",
          installedAt: "2026-01-01T00:00:00.000Z",
          agents: ["claude-code"],
          canonicalPath: "/tmp/alpha",
          isGlobal: true,
        },
      },
    }));
    mocks.parseSource.mockReturnValue({ type: "github", owner: "owner", repo: "alpha", ref: "main" });

    mocks.listRemote.mockResolvedValueOnce("abc1234ffff\trefs/heads/main");
    await expect(checkSkillUpdate("alpha")).resolves.toEqual({
      hasUpdate: false,
      currentVersion: "abc1234",
      latestVersion: "abc1234ffff",
      status: "up-to-date",
    });

    mocks.listRemote.mockResolvedValueOnce("fffeee111222\trefs/heads/main");
    await expect(checkSkillUpdate("alpha")).resolves.toEqual({
      hasUpdate: true,
      currentVersion: "abc1234",
      latestVersion: "fffeee111222",
      status: "update-available",
    });
  });
});
