/**
 * CLEO MCP channel profile helpers.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";
import type { McpServerConfig } from "../../types.js";

export type CleoChannel = "stable" | "beta" | "dev";

export const CLEO_SERVER_NAMES: Record<CleoChannel, string> = {
  stable: "cleo",
  beta: "cleo-beta",
  dev: "cleo-dev",
};

export const CLEO_MCP_NPM_PACKAGE = "@cleocode/cleo";
export const CLEO_DEV_DIR_DEFAULT = "~/.cleo-dev";

export interface CleoProfileBuildOptions {
  channel: CleoChannel;
  version?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cleoDir?: string;
}

export interface CleoProfileBuildResult {
  channel: CleoChannel;
  serverName: string;
  config: McpServerConfig;
  packageSpec?: string;
}

export interface CommandReachability {
  reachable: boolean;
  method: "path" | "lookup";
  detail: string;
}

export function normalizeCleoChannel(value?: string): CleoChannel {
  if (!value || value.trim() === "") return "stable";
  const normalized = value.trim().toLowerCase();
  if (normalized === "stable" || normalized === "beta" || normalized === "dev") {
    return normalized;
  }
  throw new Error(`Invalid channel \"${value}\". Expected stable, beta, or dev.`);
}

export function resolveCleoServerName(channel: CleoChannel): string {
  return CLEO_SERVER_NAMES[channel];
}

export function resolveChannelFromServerName(serverName: string): CleoChannel | null {
  if (serverName === CLEO_SERVER_NAMES.stable) return "stable";
  if (serverName === CLEO_SERVER_NAMES.beta) return "beta";
  if (serverName === CLEO_SERVER_NAMES.dev) return "dev";
  return null;
}

function splitCommand(command: string, explicitArgs: string[] = []): { command: string; args: string[] } {
  if (explicitArgs.length > 0) {
    return { command, args: explicitArgs };
  }
  const parts = command.trim().split(/\s+/);
  const binary = parts[0] ?? "";
  if (!binary) {
    throw new Error("Command is required for dev channel.");
  }
  return {
    command: binary,
    args: parts.slice(1),
  };
}

function normalizeEnv(
  env: Record<string, string> | undefined,
  channel: CleoChannel,
  cleoDir?: string,
): Record<string, string> | undefined {
  const result = { ...(env ?? {}) };
  if (channel === "dev" && !result.CLEO_DIR) {
    result.CLEO_DIR = cleoDir ?? CLEO_DEV_DIR_DEFAULT;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function resolvePackageSpec(channel: CleoChannel, version?: string): string {
  const tag = version?.trim() || (channel === "stable" ? "latest" : "beta");
  return `${CLEO_MCP_NPM_PACKAGE}@${tag}`;
}

export function buildCleoProfile(options: CleoProfileBuildOptions): CleoProfileBuildResult {
  const channel = options.channel;
  const serverName = resolveCleoServerName(channel);

  if (channel === "dev") {
    if (!options.command || options.command.trim() === "") {
      throw new Error("Dev channel requires --command.");
    }

    const parsed = splitCommand(options.command, options.args ?? []);
    const env = normalizeEnv(options.env, channel, options.cleoDir);
    return {
      channel,
      serverName,
      config: {
        command: parsed.command,
        args: parsed.args,
        ...(env ? { env } : {}),
      },
    };
  }

  const packageSpec = resolvePackageSpec(channel, options.version);
  return {
    channel,
    serverName,
    packageSpec,
    config: {
      command: "npx",
      args: ["-y", packageSpec, "mcp"],
    },
  };
}

function expandHome(pathValue: string): string {
  if (pathValue === "~") return homedir();
  if (pathValue.startsWith("~/")) {
    return resolve(homedir(), pathValue.slice(2));
  }
  return pathValue;
}

export function checkCommandReachability(command: string): CommandReachability {
  const hasPathSeparator = command.includes("/") || command.includes("\\");
  if (hasPathSeparator || command.startsWith("~")) {
    const expanded = expandHome(command);
    const candidate = isAbsolute(expanded) ? expanded : resolve(process.cwd(), expanded);
    if (existsSync(candidate)) {
      return { reachable: true, method: "path", detail: candidate };
    }
    return { reachable: false, method: "path", detail: candidate };
  }

  try {
    const lookup = process.platform === "win32" ? "where" : "which";
    execFileSync(lookup, [command], { stdio: "pipe" });
    return { reachable: true, method: "lookup", detail: command };
  } catch {
    return { reachable: false, method: "lookup", detail: command };
  }
}

export function parseEnvAssignments(values: string[]): Record<string, string> {
  const env: Record<string, string> = {};
  for (const value of values) {
    const idx = value.indexOf("=");
    if (idx <= 0) {
      throw new Error(`Invalid --env value \"${value}\". Use KEY=value.`);
    }
    const key = value.slice(0, idx).trim();
    const val = value.slice(idx + 1).trim();
    if (!key) {
      throw new Error(`Invalid --env value \"${value}\". Key cannot be empty.`);
    }
    env[key] = val;
  }
  return env;
}

export function extractVersionTag(packageSpec?: string): string | undefined {
  if (!packageSpec) return undefined;
  const atIndex = packageSpec.lastIndexOf("@");
  if (atIndex <= 0) return undefined;
  return packageSpec.slice(atIndex + 1);
}

export function isCleoSource(source: string): boolean {
  return source.trim().toLowerCase() === "cleo";
}
