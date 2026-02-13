/**
 * TOML config reader/writer
 */

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import TOML from "@iarna/toml";
import { deepMerge, ensureDir } from "./utils.js";

/** Read a TOML config file */
export async function readTomlConfig(filePath: string): Promise<Record<string, unknown>> {
  if (!existsSync(filePath)) return {};

  const content = await readFile(filePath, "utf-8");
  if (!content.trim()) return {};

  const result = TOML.parse(content);
  return result as unknown as Record<string, unknown>;
}

/** Write a server config to a TOML file */
export async function writeTomlConfig(
  filePath: string,
  configKey: string,
  serverName: string,
  serverConfig: unknown,
): Promise<void> {
  await ensureDir(filePath);

  const existing = await readTomlConfig(filePath);

  // Build nested structure
  const keyParts = configKey.split(".");
  let newEntry: Record<string, unknown> = { [serverName]: serverConfig };

  for (const part of [...keyParts].reverse()) {
    newEntry = { [part]: newEntry };
  }

  const merged = deepMerge(existing, newEntry);

  const content = TOML.stringify(merged as TOML.JsonMap);

  await writeFile(filePath, content, "utf-8");
}

/** Remove a server entry from a TOML config */
export async function removeTomlConfig(
  filePath: string,
  configKey: string,
  serverName: string,
): Promise<boolean> {
  if (!existsSync(filePath)) return false;

  const existing = await readTomlConfig(filePath);

  const keyParts = configKey.split(".");
  let current: Record<string, unknown> = existing;

  for (const part of keyParts) {
    const next = current[part];
    if (typeof next !== "object" || next === null) return false;
    current = next as Record<string, unknown>;
  }

  if (!(serverName in current)) return false;

  delete current[serverName];

  const content = TOML.stringify(existing as TOML.JsonMap);

  await writeFile(filePath, content, "utf-8");
  return true;
}
