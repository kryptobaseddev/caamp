/**
 * MCP config installer
 *
 * Writes MCP server configurations to agent config files,
 * handling per-agent formats, keys, and transformations.
 */

import { join } from "node:path";
import type { Provider, McpServerConfig, GlobalOptions } from "../../types.js";
import { writeConfig } from "../formats/index.js";
import { getTransform } from "./transforms.js";

export interface InstallResult {
  provider: Provider;
  scope: "project" | "global";
  configPath: string;
  success: boolean;
  error?: string;
}

/** Build the config to write, applying transforms if needed */
function buildConfig(provider: Provider, serverName: string, config: McpServerConfig): unknown {
  const transform = getTransform(provider.id);
  if (transform) {
    return transform(serverName, config);
  }
  return config;
}

/** Resolve the config file path for a provider */
function resolveConfigPath(provider: Provider, scope: "project" | "global", projectDir?: string): string | null {
  if (scope === "project") {
    if (!provider.configPathProject) return null;
    return join(projectDir ?? process.cwd(), provider.configPathProject);
  }
  return provider.configPathGlobal;
}

/** Install an MCP server config for a single provider */
export async function installMcpServer(
  provider: Provider,
  serverName: string,
  config: McpServerConfig,
  scope: "project" | "global" = "project",
  projectDir?: string,
): Promise<InstallResult> {
  const configPath = resolveConfigPath(provider, scope, projectDir);

  if (!configPath) {
    return {
      provider,
      scope,
      configPath: "",
      success: false,
      error: `Provider ${provider.id} does not support ${scope} config`,
    };
  }

  try {
    const transformedConfig = buildConfig(provider, serverName, config);

    await writeConfig(
      configPath,
      provider.configFormat,
      provider.configKey,
      serverName,
      transformedConfig,
    );

    return {
      provider,
      scope,
      configPath,
      success: true,
    };
  } catch (err) {
    return {
      provider,
      scope,
      configPath,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Install an MCP server config for multiple providers */
export async function installMcpServerToAll(
  providers: Provider[],
  serverName: string,
  config: McpServerConfig,
  scope: "project" | "global" = "project",
  projectDir?: string,
): Promise<InstallResult[]> {
  const results: InstallResult[] = [];

  for (const provider of providers) {
    const result = await installMcpServer(provider, serverName, config, scope, projectDir);
    results.push(result);
  }

  return results;
}

/** Build a canonical MCP server config from parsed source */
export function buildServerConfig(
  source: { type: string; value: string },
  transport?: string,
  headers?: Record<string, string>,
): McpServerConfig {
  if (source.type === "remote") {
    return {
      type: (transport ?? "http") as "sse" | "http",
      url: source.value,
      ...(headers && Object.keys(headers).length > 0 ? { headers } : {}),
    };
  }

  if (source.type === "package") {
    return {
      command: "npx",
      args: ["-y", source.value],
    };
  }

  // Command type - split into command and args
  const parts = source.value.split(/\s+/);
  return {
    command: parts[0]!,
    args: parts.slice(1),
  };
}
