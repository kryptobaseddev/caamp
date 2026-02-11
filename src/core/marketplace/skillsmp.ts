/**
 * agentskills.in marketplace adapter
 *
 * Connects to the SkillsMP API for skill discovery.
 * GitHub is always the actual source for installation.
 */

import type { MarketplaceAdapter, MarketplaceResult, SearchOptions } from "./types.js";

const API_BASE = "https://www.agentskills.in/api/skills";

interface ApiSkill {
  id: string;
  name: string;
  description: string;
  author: string;
  scopedName: string;
  stars: number;
  forks: number;
  githubUrl: string;
  repoFullName: string;
  path: string;
  category?: string;
  hasContent: boolean;
}

interface ApiResponse {
  skills: ApiSkill[];
  total: number;
  limit: number;
  offset: number;
}

function toResult(skill: ApiSkill): MarketplaceResult {
  return {
    name: skill.name,
    scopedName: skill.scopedName,
    description: skill.description,
    author: skill.author,
    stars: skill.stars,
    githubUrl: skill.githubUrl,
    repoFullName: skill.repoFullName,
    path: skill.path,
    source: "agentskills.in",
  };
}

export class SkillsMPAdapter implements MarketplaceAdapter {
  name = "agentskills.in";

  async search(query: string, limit = 20): Promise<MarketplaceResult[]> {
    const params = new URLSearchParams({
      search: query,
      limit: String(limit),
      sortBy: "stars",
    });

    try {
      const response = await fetch(`${API_BASE}?${params}`);
      if (!response.ok) return [];

      const data = (await response.json()) as ApiResponse;
      return data.skills.map(toResult);
    } catch {
      return [];
    }
  }

  async getSkill(scopedName: string): Promise<MarketplaceResult | null> {
    const params = new URLSearchParams({
      search: scopedName,
      limit: "1",
    });

    try {
      const response = await fetch(`${API_BASE}?${params}`);
      if (!response.ok) return null;

      const data = (await response.json()) as ApiResponse;
      const match = data.skills.find(
        (s) => s.scopedName === scopedName || `@${s.author}/${s.name}` === scopedName,
      );
      return match ? toResult(match) : null;
    } catch {
      return null;
    }
  }
}
