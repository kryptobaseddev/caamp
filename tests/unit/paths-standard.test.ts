import { afterEach, describe, expect, it } from "vitest";
import {
  getAgentsHome,
  getCanonicalSkillsDir,
  getLockFilePath,
  resolveRegistryTemplatePath,
} from "../../src/core/paths/standard.js";

const originalAgentsHome = process.env["AGENTS_HOME"];

describe("paths standard", () => {
  afterEach(() => {
    if (originalAgentsHome === undefined) {
      delete process.env["AGENTS_HOME"];
    } else {
      process.env["AGENTS_HOME"] = originalAgentsHome;
    }
  });

  it("respects AGENTS_HOME override for canonical paths", () => {
    process.env["AGENTS_HOME"] = "~/custom-agents";

    expect(getAgentsHome()).toContain("custom-agents");
    expect(getCanonicalSkillsDir()).toContain("custom-agents");
    expect(getLockFilePath()).toContain("custom-agents");
  });

  it("resolves registry template variables", () => {
    process.env["AGENTS_HOME"] = "~/agents-override";
    const resolved = resolveRegistryTemplatePath("$AGENTS_HOME/skills");
    expect(resolved).toContain("agents-override");
    expect(resolved).not.toContain("$AGENTS_HOME");
  });
});
