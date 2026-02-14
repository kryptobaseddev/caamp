import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readFileSync: vi.fn(),
}));

vi.mock("node:fs", () => ({
  readFileSync: mocks.readFileSync,
}));

describe("version", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    mocks.readFileSync.mockReset();
  });

  it("reads version from package.json and caches it", async () => {
    mocks.readFileSync.mockReturnValue('{"version":"9.8.7"}');
    const { getCaampVersion } = await import("../../src/core/version.js");

    expect(getCaampVersion()).toBe("9.8.7");
    expect(getCaampVersion()).toBe("9.8.7");
    expect(mocks.readFileSync).toHaveBeenCalledTimes(1);
  });

  it("falls back to 0.0.0 when version is missing", async () => {
    mocks.readFileSync.mockReturnValue("{}");
    const { getCaampVersion } = await import("../../src/core/version.js");

    expect(getCaampVersion()).toBe("0.0.0");
  });

  it("falls back to 0.0.0 when package read fails", async () => {
    mocks.readFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    const { getCaampVersion } = await import("../../src/core/version.js");

    expect(getCaampVersion()).toBe("0.0.0");
  });
});
