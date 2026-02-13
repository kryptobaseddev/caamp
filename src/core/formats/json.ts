/**
 * JSON/JSONC config reader/writer with comment preservation
 *
 * Uses jsonc-parser for surgical edits that preserve comments,
 * formatting, and trailing commas in JSONC files.
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import * as jsonc from "jsonc-parser";
import { ensureDir } from "./utils.js";

/** Read a JSON/JSONC config file */
export async function readJsonConfig(filePath: string): Promise<Record<string, unknown>> {
  if (!existsSync(filePath)) return {};

  const content = await readFile(filePath, "utf-8");
  if (!content.trim()) return {};

  const errors: jsonc.ParseError[] = [];
  const result = jsonc.parse(content, errors);

  if (errors.length > 0) {
    // Fall back to standard JSON parse for better error messages
    return JSON.parse(content) as Record<string, unknown>;
  }

  return (result ?? {}) as Record<string, unknown>;
}

/** Detect indentation from existing file content */
function detectIndent(content: string): { indent: string; insertSpaces: boolean; tabSize: number } {
  const lines = content.split("\n");
  for (const line of lines) {
    const match = line.match(/^(\s+)/);
    if (match?.[1]) {
      const ws = match[1];
      if (ws.startsWith("\t")) {
        return { indent: "\t", insertSpaces: false, tabSize: 1 };
      }
      return { indent: ws, insertSpaces: true, tabSize: ws.length };
    }
  }
  return { indent: "  ", insertSpaces: true, tabSize: 2 };
}

/** Write a server config to a JSON/JSONC file, preserving comments */
export async function writeJsonConfig(
  filePath: string,
  configKey: string,
  serverName: string,
  serverConfig: unknown,
): Promise<void> {
  await ensureDir(filePath);

  let content: string;

  if (existsSync(filePath)) {
    content = await readFile(filePath, "utf-8");
    if (!content.trim()) {
      content = "{}";
    }
  } else {
    content = "{}";
  }

  const { tabSize, insertSpaces } = detectIndent(content);

  const formatOptions: jsonc.FormattingOptions = {
    tabSize,
    insertSpaces,
    eol: "\n",
  };

  // Build the JSON path for the server entry
  const keyParts = configKey.split(".");
  const jsonPath = [...keyParts, serverName];

  // Use jsonc.modify for surgical, comment-preserving edits
  const edits = jsonc.modify(content, jsonPath, serverConfig, { formattingOptions: formatOptions });

  if (edits.length > 0) {
    content = jsonc.applyEdits(content, edits);
  }

  // Ensure trailing newline
  if (!content.endsWith("\n")) {
    content += "\n";
  }

  await writeFile(filePath, content, "utf-8");
}

/** Remove a server entry from a JSON/JSONC config */
export async function removeJsonConfig(
  filePath: string,
  configKey: string,
  serverName: string,
): Promise<boolean> {
  if (!existsSync(filePath)) return false;

  let content = await readFile(filePath, "utf-8");
  if (!content.trim()) return false;

  const { tabSize, insertSpaces } = detectIndent(content);

  const formatOptions: jsonc.FormattingOptions = {
    tabSize,
    insertSpaces,
    eol: "\n",
  };

  const keyParts = configKey.split(".");
  const jsonPath = [...keyParts, serverName];

  const edits = jsonc.modify(content, jsonPath, undefined, { formattingOptions: formatOptions });

  if (edits.length === 0) return false;

  content = jsonc.applyEdits(content, edits);

  if (!content.endsWith("\n")) {
    content += "\n";
  }

  await writeFile(filePath, content, "utf-8");
  return true;
}
