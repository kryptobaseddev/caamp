import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CaampLockFile } from "../../src/types.js";

const mockedPaths = vi.hoisted(() => {
  const agentsHome = `/tmp/caamp-lock-utils-${process.pid}`;
  return {
    AGENTS_HOME: agentsHome,
    LOCK_FILE_PATH: `${agentsHome}/.caamp-lock.json`,
  };
});

vi.mock("../../src/core/paths/agents.js", () => ({
  AGENTS_HOME: mockedPaths.AGENTS_HOME,
  LOCK_FILE_PATH: mockedPaths.LOCK_FILE_PATH,
}));

import { readLockFile, writeLockFile } from "../../src/core/lock-utils.js";

describe("lock-utils", () => {
  beforeEach(async () => {
    await rm(mockedPaths.AGENTS_HOME, { recursive: true, force: true });
  });

  it("returns empty lock shape when file is missing", async () => {
    const lock = await readLockFile();
    expect(lock).toEqual({ version: 1, skills: {}, mcpServers: {} });
  });

  it("writes lock file and reads it back", async () => {
    const expected: CaampLockFile = {
      version: 1,
      skills: {
        demo: {
          name: "demo",
          scopedName: "@test/demo",
          source: "github",
          sourceType: "github",
          agents: ["claude-code"],
          canonicalPath: "/tmp/demo",
          isGlobal: true,
          installedAt: "2026-01-01T00:00:00.000Z",
        },
      },
      mcpServers: {},
    };

    await writeLockFile(expected);

    expect(existsSync(mockedPaths.LOCK_FILE_PATH)).toBe(true);
    const content = await readFile(mockedPaths.LOCK_FILE_PATH, "utf-8");
    expect(content.endsWith("\n")).toBe(true);

    const loaded = await readLockFile();
    expect(loaded).toEqual(expected);
  });

  it("falls back to empty lock when json is invalid", async () => {
    await mkdir(mockedPaths.AGENTS_HOME, { recursive: true });
    await writeFile(mockedPaths.LOCK_FILE_PATH, "{bad-json", "utf-8");

    const lock = await readLockFile();
    expect(lock).toEqual({ version: 1, skills: {}, mcpServers: {} });
  });
});
