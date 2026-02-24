/**
 * Instruction template management
 *
 * Generates injection content based on provider capabilities.
 * Includes structured InjectionTemplate API for project-level customization.
 */

import type { Provider } from "../../types.js";

// ── InjectionTemplate API ───────────────────────────────────────────

/**
 * Structured template for injection content.
 *
 * Projects use this to define what goes between CAAMP markers in
 * instruction files, rather than passing ad-hoc strings.
 */
export interface InjectionTemplate {
  /** @ references to include (e.g. `"@AGENTS.md"`, `"@.cleo/project-context.json"`). */
  references: string[];
  /** Inline content blocks (raw markdown/text). */
  content?: string[];
}

/**
 * Build injection content from a structured template.
 *
 * Produces a string suitable for injection between CAAMP markers.
 * References are output as `@` lines, content blocks are appended as-is.
 *
 * @param template - Template defining references and content
 * @returns Formatted injection content string
 *
 * @example
 * ```typescript
 * const content = buildInjectionContent({
 *   references: ["@AGENTS.md"],
 * });
 * // Returns: "@AGENTS.md"
 *
 * const content2 = buildInjectionContent({
 *   references: ["@AGENTS.md", "@.cleo/project-context.json"],
 *   content: ["# Custom Section", "Some extra info"],
 * });
 * ```
 */
export function buildInjectionContent(template: InjectionTemplate): string {
  const lines: string[] = [];

  for (const ref of template.references) {
    lines.push(ref);
  }

  if (template.content && template.content.length > 0) {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push(...template.content);
  }

  return lines.join("\n");
}

/**
 * Parse injection content back into template form.
 *
 * Lines starting with `@` are treated as references.
 * All other non-empty lines are treated as content blocks.
 *
 * @param content - Raw injection content string
 * @returns Parsed InjectionTemplate
 *
 * @example
 * ```typescript
 * const template = parseInjectionContent("@AGENTS.md\n@.cleo/config.json");
 * // { references: ["@AGENTS.md", "@.cleo/config.json"], content: [] }
 * ```
 */
export function parseInjectionContent(content: string): InjectionTemplate {
  const references: string[] = [];
  const contentLines: string[] = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("@")) {
      references.push(trimmed);
    } else {
      contentLines.push(line);
    }
  }

  return {
    references,
    content: contentLines.length > 0 ? contentLines : undefined,
  };
}

// ── Legacy API (preserved) ──────────────────────────────────────────

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
