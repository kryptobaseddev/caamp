/**
 * GitLab fetcher for skill/MCP sources
 */

import { simpleGit } from "simple-git";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GitFetchResult } from "./github.js";

/** Clone a GitLab repo to a temp directory */
export async function cloneGitLabRepo(
  owner: string,
  repo: string,
  ref?: string,
  subPath?: string,
): Promise<GitFetchResult> {
  const tmpDir = await mkdtemp(join(tmpdir(), "caamp-gl-"));
  const repoUrl = `https://gitlab.com/${owner}/${repo}.git`;

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

/** Fetch a specific file from GitLab using the raw API */
export async function fetchGitLabRawFile(
  owner: string,
  repo: string,
  path: string,
  ref = "main",
): Promise<string | null> {
  const encodedPath = encodeURIComponent(path);
  const url = `https://gitlab.com/${owner}/${repo}/-/raw/${ref}/${encodedPath}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}
