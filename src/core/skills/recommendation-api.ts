import { MarketplaceClient } from "../marketplace/client.js";
import {
  RECOMMENDATION_ERROR_CODES,
  recommendSkills as rankSkills,
  type RecommendationCriteriaInput,
  type RecommendationOptions,
  type RecommendSkillsResult,
} from "./recommendation.js";

export interface SearchSkillsOptions {
  limit?: number;
}

export interface RecommendSkillsQueryOptions extends RecommendationOptions {
  limit?: number;
}

export function formatSkillRecommendations(
  result: RecommendSkillsResult,
  opts: { mode: "human" | "json"; details?: boolean },
): string | Record<string, unknown> {
  const top = result.ranking;

  if (opts.mode === "human") {
    if (top.length === 0) return "No recommendations found.";
    const lines: string[] = ["Recommended skills:", ""];
    for (const [index, entry] of top.entries()) {
      const marker = index === 0 ? " (Recommended)" : "";
      lines.push(`${index + 1}) ${entry.skill.scopedName}${marker}`);
      lines.push(`   why: ${entry.reasons.map((reason) => reason.code).join(", ") || "score-based match"}`);
      lines.push(`   tradeoff: ${entry.tradeoffs[0] ?? "none"}`);
    }
    lines.push("");
    lines.push(`CHOOSE: ${top.map((_, index) => index + 1).join(",")}`);
    return lines.join("\n");
  }

  const options = top.map((entry, index) => ({
    rank: index + 1,
    scopedName: entry.skill.scopedName,
    score: entry.score,
    reasons: entry.reasons,
    tradeoffs: entry.tradeoffs,
    ...(opts.details
      ? {
          description: entry.skill.description,
          source: entry.skill.source,
          evidence: entry.breakdown ?? null,
        }
      : {}),
  }));

  return {
    query: result.criteria.query,
    recommended: options[0] ?? null,
    options,
  };
}

export async function searchSkills(query: string, options: SearchSkillsOptions = {}) {
  const trimmed = query.trim();
  if (!trimmed) {
    const error = new Error("query must be non-empty") as Error & { code?: string };
    error.code = RECOMMENDATION_ERROR_CODES.QUERY_INVALID;
    throw error;
  }

  const client = new MarketplaceClient();
  try {
    return await client.search(trimmed, options.limit ?? 20);
  } catch (error) {
    const wrapped = new Error(error instanceof Error ? error.message : String(error)) as Error & { code?: string };
    wrapped.code = RECOMMENDATION_ERROR_CODES.SOURCE_UNAVAILABLE;
    throw wrapped;
  }
}

export async function recommendSkills(
  query: string,
  criteria: Omit<RecommendationCriteriaInput, "query">,
  options: RecommendSkillsQueryOptions = {},
): Promise<RecommendSkillsResult> {
  const hits = await searchSkills(query, { limit: options.limit ?? Math.max((options.top ?? 3) * 5, 20) });
  const ranked = rankSkills(hits, { ...criteria, query }, options);

  if (ranked.ranking.length === 0) {
    const error = new Error("no matches found") as Error & { code?: string };
    error.code = RECOMMENDATION_ERROR_CODES.NO_MATCHES;
    throw error;
  }

  return ranked;
}
