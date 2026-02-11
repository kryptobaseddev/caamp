/**
 * GitHub fetcher for skill/MCP sources
 *
 * Clones repos or fetches specific paths via simple-git.
 */

import { simpleGit } from "simple-git";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";

export interface GitFetchResult {
  localPath: string;
  cleanup: () => Promise<void>;
}

/** Clone a GitHub repo to a temp directory */
export async function cloneRepo(
  owner: string,
  repo: string,
  ref?: string,
  subPath?: string,
): Promise<GitFetchResult> {
  const tmpDir = await mkdtemp(join(tmpdir(), "caamp-"));
  const repoUrl = `https://github.com/${owner}/${repo}.git`;

  const git = simpleGit();

  const cloneOptions = ["--depth", "1"];
  if (ref) {
    cloneOptions.push("--branch", ref);
  }

  await git.clone(repoUrl, tmpDir, cloneOptions);

  const localPath = subPath ? join(tmpDir, subPath) : tmpDir;

  return {
    localPath,
    cleanup: async () => {
      try {
        await rm(tmpDir, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    },
  };
}

/** Fetch a specific file from GitHub using the raw API */
export async function fetchRawFile(
  owner: string,
  repo: string,
  path: string,
  ref = "main",
): Promise<string | null> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

/** Check if a GitHub repo exists */
export async function repoExists(owner: string, repo: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      method: "HEAD",
    });
    return response.ok;
  } catch {
    return false;
  }
}
