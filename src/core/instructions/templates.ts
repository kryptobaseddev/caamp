/**
 * Instruction template management
 *
 * Generates injection content based on provider capabilities.
 */

import type { Provider } from "../../types.js";

/** Generate a standard CAAMP injection block */
export function generateInjectionContent(options?: {
  mcpServerName?: string;
  customContent?: string;
}): string {
  const lines: string[] = [];

  lines.push("## CAAMP Managed Configuration");
  lines.push("");
  lines.push("This section is managed by [CAAMP](https://github.com/caamp/caamp).");
  lines.push("Do not edit between the CAAMP markers manually.");

  if (options?.mcpServerName) {
    lines.push("");
    lines.push(`### MCP Server: ${options.mcpServerName}`);
    lines.push(`Configured via \`caamp mcp install\`.`);
  }

  if (options?.customContent) {
    lines.push("");
    lines.push(options.customContent);
  }

  return lines.join("\n");
}

/** Generate a skills discovery section for instruction files */
export function generateSkillsSection(skillNames: string[]): string {
  if (skillNames.length === 0) return "";

  const lines: string[] = [];
  lines.push("### Installed Skills");
  lines.push("");

  for (const name of skillNames) {
    lines.push(`- \`${name}\` - Available via SKILL.md`);
  }

  return lines.join("\n");
}

/** Get the correct instruction file name for a provider */
export function getInstructFile(provider: Provider): string {
  return provider.instructFile;
}

/** Group providers by instruction file */
export function groupByInstructFile(providers: Provider[]): Map<string, Provider[]> {
  const groups = new Map<string, Provider[]>();

  for (const provider of providers) {
    const existing = groups.get(provider.instructFile) ?? [];
    existing.push(provider);
    groups.set(provider.instructFile, existing);
  }

  return groups;
}
