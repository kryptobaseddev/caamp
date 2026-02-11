/**
 * YAML config reader/writer
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import yaml from "js-yaml";
import { deepMerge, ensureDir } from "./utils.js";

/** Read a YAML config file */
export async function readYamlConfig(filePath: string): Promise<Record<string, unknown>> {
  if (!existsSync(filePath)) return {};

  const content = await readFile(filePath, "utf-8");
  if (!content.trim()) return {};

  const result = yaml.load(content);
  return (result ?? {}) as Record<string, unknown>;
}

/** Write a server config to a YAML file */
export async function writeYamlConfig(
  filePath: string,
  configKey: string,
  serverName: string,
  serverConfig: unknown,
): Promise<void> {
  await ensureDir(filePath);

  const existing = await readYamlConfig(filePath);

  // Build nested structure
  const keyParts = configKey.split(".");
  let newEntry: Record<string, unknown> = { [serverName]: serverConfig };

  for (let i = keyParts.length - 1; i >= 0; i--) {
    newEntry = { [keyParts[i]!]: newEntry };
  }

  const merged = deepMerge(existing, newEntry);

  const content = yaml.dump(merged, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });

  await writeFile(filePath, content, "utf-8");
}

/** Remove a server entry from a YAML config */
export async function removeYamlConfig(
  filePath: string,
  configKey: string,
  serverName: string,
): Promise<boolean> {
  if (!existsSync(filePath)) return false;

  const existing = await readYamlConfig(filePath);

  // Navigate to the config key
  const keyParts = configKey.split(".");
  let current: Record<string, unknown> = existing;

  for (const part of keyParts) {
    const next = current[part];
    if (typeof next !== "object" || next === null) return false;
    current = next as Record<string, unknown>;
  }

  if (!(serverName in current)) return false;

  delete current[serverName];

  const content = yaml.dump(existing, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });

  await writeFile(filePath, content, "utf-8");
  return true;
}
