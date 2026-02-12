/**
 * Shared helpers for advanced command input parsing and validation.
 */

import { readFile } from "node:fs/promises";
import type {
  McpBatchOperation,
  SkillBatchOperation,
} from "../../core/advanced/orchestration.js";
import type { Provider, ProviderPriority } from "../../types.js";
import { getInstalledProviders } from "../../core/registry/detection.js";
import { getAllProviders, getProvider } from "../../core/registry/providers.js";
import { LAFSCommandError } from "./lafs.js";

const VALID_PRIORITIES = new Set<ProviderPriority>(["high", "medium", "low"]);

export interface ProviderTargetOptions {
  all?: boolean;
  agent?: string[];
}

export function parsePriority(value: string): ProviderPriority {
  if (!VALID_PRIORITIES.has(value as ProviderPriority)) {
    throw new LAFSCommandError(
      "E_ADVANCED_VALIDATION_PRIORITY",
      `Invalid tier: ${value}`,
      "Use one of: high, medium, low.",
    );
  }
  return value as ProviderPriority;
}

export function resolveProviders(options: ProviderTargetOptions): Provider[] {
  if (options.all) {
    return getAllProviders();
  }

  const targetAgents = options.agent ?? [];
  if (targetAgents.length === 0) {
    return getInstalledProviders();
  }

  const providers = targetAgents
    .map((id) => getProvider(id))
    .filter((provider): provider is Provider => provider !== undefined);

  if (providers.length !== targetAgents.length) {
    const found = new Set(providers.map((provider) => provider.id));
    const missing = targetAgents.filter((id) => !found.has(id));
    throw new LAFSCommandError(
      "E_ADVANCED_PROVIDER_NOT_FOUND",
      `Unknown provider(s): ${missing.join(", ")}`,
      "Check `caamp providers list` for valid provider IDs/aliases.",
    );
  }

  return providers;
}

export async function readJsonFile(path: string): Promise<unknown> {
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new LAFSCommandError(
      "E_ADVANCED_INPUT_JSON",
      `Failed to read JSON file: ${path}`,
      "Confirm the path exists and contains valid JSON.",
      true,
      { reason: error instanceof Error ? error.message : String(error) },
    );
  }
}

export async function readMcpOperations(path: string): Promise<McpBatchOperation[]> {
  const value = await readJsonFile(path);
  if (!Array.isArray(value)) {
    throw new LAFSCommandError(
      "E_ADVANCED_VALIDATION_MCP_ARRAY",
      `MCP operations file must be a JSON array: ${path}`,
      "Provide an array of objects with serverName and config fields.",
    );
  }

  const operations: McpBatchOperation[] = [];
  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== "object") {
      throw new LAFSCommandError(
        "E_ADVANCED_VALIDATION_MCP_ITEM",
        `Invalid MCP operation at index ${index}`,
        "Each operation must be an object with serverName and config.",
      );
    }

    const obj = item as Record<string, unknown>;
    const serverName = obj["serverName"];
    const config = obj["config"];
    const scope = obj["scope"];

    if (typeof serverName !== "string" || serverName.length === 0) {
      throw new LAFSCommandError(
        "E_ADVANCED_VALIDATION_MCP_NAME",
        `Invalid serverName at index ${index}`,
        "Set serverName to a non-empty string.",
      );
    }

    if (!config || typeof config !== "object" || Array.isArray(config)) {
      throw new LAFSCommandError(
        "E_ADVANCED_VALIDATION_MCP_CONFIG",
        `Invalid config at index ${index}`,
        "Set config to an object matching McpServerConfig.",
      );
    }

    if (scope !== undefined && scope !== "project" && scope !== "global") {
      throw new LAFSCommandError(
        "E_ADVANCED_VALIDATION_SCOPE",
        `Invalid scope at index ${index}: ${String(scope)}`,
        "Use scope value 'project' or 'global'.",
      );
    }

    operations.push({
      serverName,
      config: config as McpBatchOperation["config"],
      ...(scope ? { scope: scope as "project" | "global" } : {}),
    });
  }

  return operations;
}

export async function readSkillOperations(path: string): Promise<SkillBatchOperation[]> {
  const value = await readJsonFile(path);
  if (!Array.isArray(value)) {
    throw new LAFSCommandError(
      "E_ADVANCED_VALIDATION_SKILL_ARRAY",
      `Skill operations file must be a JSON array: ${path}`,
      "Provide an array of objects with sourcePath and skillName fields.",
    );
  }

  const operations: SkillBatchOperation[] = [];
  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== "object") {
      throw new LAFSCommandError(
        "E_ADVANCED_VALIDATION_SKILL_ITEM",
        `Invalid skill operation at index ${index}`,
        "Each operation must be an object with sourcePath and skillName.",
      );
    }

    const obj = item as Record<string, unknown>;
    const sourcePath = obj["sourcePath"];
    const skillName = obj["skillName"];
    const isGlobal = obj["isGlobal"];

    if (typeof sourcePath !== "string" || sourcePath.length === 0) {
      throw new LAFSCommandError(
        "E_ADVANCED_VALIDATION_SKILL_SOURCE",
        `Invalid sourcePath at index ${index}`,
        "Set sourcePath to a non-empty string.",
      );
    }

    if (typeof skillName !== "string" || skillName.length === 0) {
      throw new LAFSCommandError(
        "E_ADVANCED_VALIDATION_SKILL_NAME",
        `Invalid skillName at index ${index}`,
        "Set skillName to a non-empty string.",
      );
    }

    if (isGlobal !== undefined && typeof isGlobal !== "boolean") {
      throw new LAFSCommandError(
        "E_ADVANCED_VALIDATION_SKILL_SCOPE",
        `Invalid isGlobal value at index ${index}`,
        "Set isGlobal to true or false when provided.",
      );
    }

    operations.push({
      sourcePath,
      skillName,
      ...(isGlobal !== undefined ? { isGlobal } : {}),
    });
  }

  return operations;
}

export async function readTextInput(
  inlineContent: string | undefined,
  filePath: string | undefined,
): Promise<string | undefined> {
  if (inlineContent && filePath) {
    throw new LAFSCommandError(
      "E_ADVANCED_VALIDATION_INPUT_MODE",
      "Provide either inline content or a content file, not both.",
      "Use --content OR --content-file.",
    );
  }

  if (inlineContent) return inlineContent;
  if (!filePath) return undefined;

  try {
    return await readFile(filePath, "utf-8");
  } catch (error) {
    throw new LAFSCommandError(
      "E_ADVANCED_INPUT_TEXT",
      `Failed to read content file: ${filePath}`,
      "Confirm the file exists and is readable.",
      true,
      { reason: error instanceof Error ? error.message : String(error) },
    );
  }
}
