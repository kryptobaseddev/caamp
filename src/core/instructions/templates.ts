/**
 * Instruction template management
 *
 * Generates injection content based on provider capabilities.
 */

import type { Provider } from "../../types.js";

/**
 * Generate a standard CAAMP injection block for instruction files.
 *
 * Produces markdown content suitable for injection between CAAMP markers.
 * Optionally includes MCP server and custom content sections.
 *
 * @param options - Optional configuration for the generated content
 * @param options.mcpServerName - MCP server name to include a server section
 * @param options.customContent - Additional custom markdown content to append
 * @returns Generated markdown string
 *
 * @example
 * ```typescript
 * const content = generateInjectionContent({ mcpServerName: "filesystem" });
 * ```
 */
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

/**
 * Group providers by their instruction file name.
 *
 * Useful for determining which providers share the same instruction file
 * (e.g. multiple providers using `AGENTS.md`).
 *
 * @param providers - Array of providers to group
 * @returns Map from instruction file name to array of providers using that file
 *
 * @example
 * ```typescript
 * const groups = groupByInstructFile(getAllProviders());
 * for (const [file, providers] of groups) {
 *   console.log(`${file}: ${providers.map(p => p.id).join(", ")}`);
 * }
 * ```
 */
export function groupByInstructFile(providers: Provider[]): Map<string, Provider[]> {
  const groups = new Map<string, Provider[]>();

  for (const provider of providers) {
    const existing = groups.get(provider.instructFile) ?? [];
    existing.push(provider);
    groups.set(provider.instructFile, existing);
  }

  return groups;
}
