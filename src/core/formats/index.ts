/**
 * Format router - dispatches config reads/writes to format-specific handlers
 */

import type { ConfigFormat } from "../../types.js";
import { readJsonConfig, writeJsonConfig } from "./json.js";
import { readYamlConfig, writeYamlConfig } from "./yaml.js";
import { readTomlConfig, writeTomlConfig } from "./toml.js";

export { deepMerge } from "./utils.js";

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
