/**
 * Source URL/path classifier
 *
 * Classifies inputs as remote URLs, npm packages, GitHub shorthand,
 * GitLab URLs, local paths, or shell commands.
 */

import type { ParsedSource, SourceType } from "../../types.js";

const GITHUB_SHORTHAND = /^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)(?:\/(.+))?$/;
const GITHUB_URL = /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+)(?:\/(.+))?)?/;
const GITLAB_URL = /^https?:\/\/(?:www\.)?gitlab\.com\/([^/]+)\/([^/]+)(?:\/-\/tree\/([^/]+)(?:\/(.+))?)?/;
const HTTP_URL = /^https?:\/\//;
const NPM_SCOPED = /^@[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
const NPM_PACKAGE = /^[a-zA-Z0-9_.-]+$/;

/** Infer a display name from a source */
function inferName(source: string, type: SourceType): string {
  if (type === "remote") {
    try {
      const url = new URL(source);
      // Extract brand from hostname: mcp.neon.tech -> neon
      const parts = url.hostname.split(".");
      if (parts.length >= 2) {
        const brand = parts.length === 3 ? parts[parts.length - 2]! : parts[0]!;
        if (brand !== "www" && brand !== "api" && brand !== "mcp") {
          return brand;
        }
        // Fall back to second-level domain
        return parts[parts.length - 2] ?? parts[0]!;
      }
      return parts[0]!;
    } catch {
      return source;
    }
  }

  if (type === "package") {
    // Strip common MCP prefixes/suffixes
    let name = source.replace(/^@[^/]+\//, ""); // Remove scope
    name = name.replace(/^mcp-server-/, "");
    name = name.replace(/^server-/, "");
    name = name.replace(/-mcp$/, "");
    name = name.replace(/-server$/, "");
    return name;
  }

  if (type === "github" || type === "gitlab") {
    // Use repo name
    const match = source.match(/\/([^/]+?)(?:\.git)?$/);
    return match?.[1] ?? source;
  }

  if (type === "local") {
    // Extract directory basename from local path
    const normalized = source.replace(/\\/g, "/").replace(/\/+$/, "");
    const lastSegment = normalized.split("/").pop();
    return lastSegment ?? source;
  }

  if (type === "command") {
    // Extract first meaningful word
    const parts = source.split(/\s+/);
    const command = parts.find((p) => !p.startsWith("-") && p !== "npx" && p !== "node" && p !== "python" && p !== "python3");
    return command ?? parts[0] ?? source;
  }

  return source;
}

/**
 * Parse and classify a source string into a typed {@link ParsedSource}.
 *
 * Supports GitHub URLs, GitLab URLs, GitHub shorthand (`owner/repo`),
 * HTTP URLs (remote MCP servers), npm package names, local paths, and
 * shell commands as a fallback.
 *
 * @param input - Raw source string to classify
 * @returns Parsed source with type, value, and inferred name
 *
 * @example
 * ```typescript
 * parseSource("owner/repo");
 * // { type: "github", value: "https://github.com/owner/repo", inferredName: "repo", ... }
 *
 * parseSource("https://mcp.example.com/sse");
 * // { type: "remote", value: "https://mcp.example.com/sse", inferredName: "example" }
 *
 * parseSource("@modelcontextprotocol/server-filesystem");
 * // { type: "package", value: "@modelcontextprotocol/server-filesystem", inferredName: "filesystem" }
 * ```
 */
export function parseSource(input: string): ParsedSource {
  // GitHub URL
  const ghUrlMatch = input.match(GITHUB_URL);
  if (ghUrlMatch) {
    return {
      type: "github",
      value: input,
      inferredName: ghUrlMatch[2]!,
      owner: ghUrlMatch[1],
      repo: ghUrlMatch[2],
      ref: ghUrlMatch[3],
      path: ghUrlMatch[4],
    };
  }

  // GitLab URL
  const glUrlMatch = input.match(GITLAB_URL);
  if (glUrlMatch) {
    return {
      type: "gitlab",
      value: input,
      inferredName: glUrlMatch[2]!,
      owner: glUrlMatch[1],
      repo: glUrlMatch[2],
      ref: glUrlMatch[3],
      path: glUrlMatch[4],
    };
  }

  // HTTP URL (non-GitHub/GitLab = remote MCP server)
  if (HTTP_URL.test(input)) {
    return {
      type: "remote",
      value: input,
      inferredName: inferName(input, "remote"),
    };
  }

  // Local path (check before GitHub shorthand since ./ and ../ match shorthand regex)
  if (input.startsWith("/") || input.startsWith("./") || input.startsWith("../") || input.startsWith("~")) {
    return {
      type: "local",
      value: input,
      inferredName: inferName(input, "local"),
    };
  }

  // GitHub shorthand: owner/repo or owner/repo/path
  const ghShorthand = input.match(GITHUB_SHORTHAND);
  if (ghShorthand && !NPM_SCOPED.test(input)) {
    return {
      type: "github",
      value: `https://github.com/${ghShorthand[1]}/${ghShorthand[2]}`,
      inferredName: ghShorthand[2]!,
      owner: ghShorthand[1],
      repo: ghShorthand[2],
      path: ghShorthand[3],
    };
  }

  // Scoped npm package: @scope/name
  if (NPM_SCOPED.test(input)) {
    return {
      type: "package",
      value: input,
      inferredName: inferName(input, "package"),
    };
  }

  // Simple npm package name (no spaces, no slashes)
  if (NPM_PACKAGE.test(input) && !input.includes(" ")) {
    return {
      type: "package",
      value: input,
      inferredName: inferName(input, "package"),
    };
  }

  // Default: treat as command
  return {
    type: "command",
    value: input,
    inferredName: inferName(input, "command"),
  };
}

/**
 * Check if a source string looks like a marketplace scoped name (`@author/name`).
 *
 * @param input - Source string to check
 * @returns `true` if the input matches the `@scope/name` pattern
 *
 * @example
 * ```typescript
 * isMarketplaceScoped("@anthropic/my-skill"); // true
 * isMarketplaceScoped("my-skill");             // false
 * isMarketplaceScoped("owner/repo");           // false
 * ```
 */
export function isMarketplaceScoped(input: string): boolean {
  return /^@[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(input);
}
