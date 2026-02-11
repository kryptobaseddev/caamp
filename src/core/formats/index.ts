/**
 * Format router - dispatches config reads/writes to format-specific handlers
 */

import type { ConfigFormat } from "../../types.js";
import { readJsonConfig, writeJsonConfig, removeJsonConfig } from "./json.js";
import { readYamlConfig, writeYamlConfig, removeYamlConfig } from "./yaml.js";
import { readTomlConfig, writeTomlConfig, removeTomlConfig } from "./toml.js";

export { deepMerge, getNestedValue, ensureDir } from "./utils.js";

/** Read a config file in the specified format */
export async function readConfig(filePath: string, format: ConfigFormat): Promise<Record<string, unknown>> {
  switch (format) {
    case "json":
    case "jsonc":
      return readJsonConfig(filePath);
    case "yaml":
      return readYamlConfig(filePath);
    case "toml":
      return readTomlConfig(filePath);
    default:
      throw new Error(`Unsupported config format: ${format as string}`);
  }
}

/** Write a config file in the specified format, preserving existing content */
export async function writeConfig(
  filePath: string,
  format: ConfigFormat,
  key: string,
  serverName: string,
  serverConfig: unknown,
): Promise<void> {
  switch (format) {
    case "json":
    case "jsonc":
      return writeJsonConfig(filePath, key, serverName, serverConfig);
    case "yaml":
      return writeYamlConfig(filePath, key, serverName, serverConfig);
    case "toml":
      return writeTomlConfig(filePath, key, serverName, serverConfig);
    default:
      throw new Error(`Unsupported config format: ${format as string}`);
  }
}

/** Remove a server entry from a config file in the specified format */
export async function removeConfig(
  filePath: string,
  format: ConfigFormat,
  key: string,
  serverName: string,
): Promise<boolean> {
  switch (format) {
    case "json":
    case "jsonc":
      return removeJsonConfig(filePath, key, serverName);
    case "yaml":
      return removeYamlConfig(filePath, key, serverName);
    case "toml":
      return removeTomlConfig(filePath, key, serverName);
    default:
      throw new Error(`Unsupported config format: ${format as string}`);
  }
}
