import { describe, expect, it } from "vitest";
import {
  buildCleoProfile,
  checkCommandReachability,
  normalizeCleoChannel,
  parseEnvAssignments,
  resolveChannelFromServerName,
  resolveCleoServerName,
} from "../../src/core/mcp/cleo.js";

describe("core: mcp cleo", () => {
  it("builds stable profile with latest package tag", () => {
    const profile = buildCleoProfile({ channel: "stable" });
    expect(profile.serverName).toBe("cleo");
    expect(profile.packageSpec).toBe("@cleocode/cleo@latest");
    expect(profile.config.command).toBe("npx");
    expect(profile.config.args).toEqual(["-y", "@cleocode/cleo@latest", "cleo-mcp"]);
  });

  it("builds beta profile with explicit pre-release", () => {
    const profile = buildCleoProfile({ channel: "beta", version: "2026.3.0-beta.1" });
    expect(profile.serverName).toBe("cleo-beta");
    expect(profile.packageSpec).toBe("@cleocode/cleo@2026.3.0-beta.1");
  });

  it("builds dev profile and defaults CLEO_DIR", () => {
    const profile = buildCleoProfile({ channel: "dev", command: "./dist/mcp/index.js", args: ["--stdio"] });
    expect(profile.serverName).toBe("cleo-dev");
    expect(profile.config.command).toBe("./dist/mcp/index.js");
    expect(profile.config.args).toEqual(["--stdio"]);
    expect(profile.config.env?.CLEO_DIR).toBe("~/.cleo-dev");
  });

  it("parses env assignments", () => {
    const env = parseEnvAssignments(["CLEO_DIR=~/.cleo-dev", "NODE_ENV=development"]);
    expect(env).toEqual({ CLEO_DIR: "~/.cleo-dev", NODE_ENV: "development" });
  });

  it("normalizes channels and maps server names", () => {
    expect(normalizeCleoChannel("Stable")).toBe("stable");
    expect(resolveCleoServerName("dev")).toBe("cleo-dev");
    expect(resolveChannelFromServerName("cleo-beta")).toBe("beta");
  });

  it("checks reachability for missing path command", () => {
    const check = checkCommandReachability("./definitely-not-a-binary");
    expect(check.reachable).toBe(false);
    expect(check.method).toBe("path");
  });
});
