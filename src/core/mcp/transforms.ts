/**
 * Per-agent MCP config transformations
 *
 * Most agents use the canonical McpServerConfig directly.
 * These transforms handle agents with non-standard schemas.
 */

import type { McpServerConfig } from "../../types.js";

/** Transform config for Goose (YAML extensions format) */
export function transformGoose(serverName: string, config: McpServerConfig): unknown {
  if (config.url) {
    // Remote server
    const transport = config.type === "sse" ? "sse" : "streamable_http";
    return {
      name: serverName,
      type: transport,
      uri: config.url,
      ...(config.headers ? { headers: config.headers } : {}),
      enabled: true,
      timeout: 300,
    };
  }

  // Stdio server
  return {
    name: serverName,
    type: "stdio",
    cmd: config.command,
    args: config.args ?? [],
    ...(config.env ? { envs: config.env } : {}),
    enabled: true,
    timeout: 300,
  };
}

/** Transform config for Zed (context_servers format) */
export function transformZed(_serverName: string, config: McpServerConfig): unknown {
  if (config.url) {
    return {
      source: "custom",
      type: config.type ?? "http",
      url: config.url,
      ...(config.headers ? { headers: config.headers } : {}),
    };
  }

  return {
    source: "custom",
    command: config.command,
    args: config.args ?? [],
    ...(config.env ? { env: config.env } : {}),
  };
}

/** Transform config for OpenCode (mcp format) */
export function transformOpenCode(_serverName: string, config: McpServerConfig): unknown {
  if (config.url) {
    return {
      type: "remote",
      url: config.url,
      enabled: true,
      ...(config.headers ? { headers: config.headers } : {}),
    };
  }

  return {
    type: "local",
    command: config.command,
    args: config.args ?? [],
    enabled: true,
    ...(config.env ? { environment: config.env } : {}),
  };
}

/** Transform config for Codex (TOML mcp_servers format) */
export function transformCodex(_serverName: string, config: McpServerConfig): unknown {
  if (config.url) {
    return {
      type: config.type ?? "http",
      url: config.url,
      ...(config.headers ? { headers: config.headers } : {}),
    };
  }

  return {
    command: config.command,
    args: config.args ?? [],
    ...(config.env ? { env: config.env } : {}),
  };
}

/** Transform config for Cursor (mcpServers format - strips type field for remote) */
export function transformCursor(_serverName: string, config: McpServerConfig): unknown {
  if (config.url) {
    return {
      url: config.url,
      ...(config.headers ? { headers: config.headers } : {}),
    };
  }

  // Stdio passthrough
  return config;
}

/**
 * Get the config transform function for a provider, or `undefined` for passthrough.
 *
 * Providers with non-standard MCP config schemas (Goose, Zed, OpenCode, Codex, Cursor)
 * require transforms to convert the canonical {@link McpServerConfig} into their
 * provider-specific format.
 *
 * @param providerId - Provider ID to look up (e.g. `"goose"`, `"zed"`)
 * @returns Transform function, or `undefined` if the provider uses the canonical format
 *
 * @example
 * ```typescript
 * const transform = getTransform("goose");
 * if (transform) {
 *   const gooseConfig = transform("my-server", canonicalConfig);
 * }
 * ```
 */
export function getTransform(
  providerId: string,
): ((name: string, config: McpServerConfig) => unknown) | undefined {
  switch (providerId) {
    case "goose":
      return transformGoose;
    case "zed":
      return transformZed;
    case "opencode":
      return transformOpenCode;
    case "codex":
      return transformCodex;
    case "cursor":
      return transformCursor;
    default:
      return undefined;
  }
}
