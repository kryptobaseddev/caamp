import type { MarketplaceResult } from "../marketplace/types.js";

export const RECOMMENDATION_ERROR_CODES = {
  EMPTY_CRITERIA: "E_SKILLS_RECOMMEND_EMPTY_CRITERIA",
  INVALID_QUERY: "E_SKILLS_RECOMMEND_INVALID_QUERY",
  INVALID_MUST_HAVE: "E_SKILLS_RECOMMEND_INVALID_MUST_HAVE",
  INVALID_PREFER: "E_SKILLS_RECOMMEND_INVALID_PREFER",
  INVALID_EXCLUDE: "E_SKILLS_RECOMMEND_INVALID_EXCLUDE",
} as const;

export type RecommendationErrorCode = (typeof RECOMMENDATION_ERROR_CODES)[keyof typeof RECOMMENDATION_ERROR_CODES];

export interface RecommendationValidationIssue {
  code: RecommendationErrorCode;
  field: "query" | "mustHave" | "prefer" | "exclude";
  message: string;
}

export interface RecommendationValidationResult {
  valid: boolean;
  issues: RecommendationValidationIssue[];
}

export interface RecommendationCriteriaInput {
  query?: string;
  mustHave?: string | string[];
  prefer?: string | string[];
  exclude?: string | string[];
}

export interface NormalizedRecommendationCriteria {
  query: string;
  queryTokens: string[];
  mustHave: string[];
  prefer: string[];
  exclude: string[];
}

export type RecommendationReasonCode =
  | "MUST_HAVE_MATCH"
  | "MISSING_MUST_HAVE"
  | "PREFER_MATCH"
  | "QUERY_MATCH"
  | "STAR_SIGNAL"
  | "METADATA_SIGNAL"
  | "MODERN_MARKER"
  | "LEGACY_MARKER"
  | "EXCLUDE_MATCH";

export interface RecommendationReason {
  code: RecommendationReasonCode;
  detail?: string;
}

export interface RecommendationScoreBreakdown {
  mustHave: number;
  prefer: number;
  query: number;
  stars: number;
  metadata: number;
  modernity: number;
  exclusionPenalty: number;
  total: number;
}

export interface RankedSkillRecommendation {
  skill: MarketplaceResult;
  score: number;
  reasons: RecommendationReason[];
  excluded: boolean;
  breakdown?: RecommendationScoreBreakdown;
}

export interface RecommendationOptions {
  top?: number;
  includeDetails?: boolean;
  weights?: Partial<RecommendationWeights>;
  modernMarkers?: string[];
  legacyMarkers?: string[];
}

export interface RecommendationWeights {
  mustHaveMatch: number;
  preferMatch: number;
  queryTokenMatch: number;
  starsFactor: number;
  metadataBoost: number;
  modernMarkerBoost: number;
  legacyMarkerPenalty: number;
  excludePenalty: number;
  missingMustHavePenalty: number;
}

export interface RecommendSkillsResult {
  criteria: NormalizedRecommendationCriteria;
  ranking: RankedSkillRecommendation[];
}

const DEFAULT_WEIGHTS: RecommendationWeights = {
  mustHaveMatch: 10,
  preferMatch: 4,
  queryTokenMatch: 3,
  starsFactor: 2,
  metadataBoost: 2,
  modernMarkerBoost: 3,
  legacyMarkerPenalty: 3,
  excludePenalty: 25,
  missingMustHavePenalty: 20,
};

const DEFAULT_MODERN_MARKERS = ["svelte 5", "runes", "lafs", "slsa", "drizzle", "better-auth"];
const DEFAULT_LEGACY_MARKERS = ["svelte 3", "jquery", "bower", "legacy"];

export function tokenizeCriteriaValue(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeList(value: unknown): string[] {
  if (value === undefined) return [];

  if (!(typeof value === "string" || Array.isArray(value))) return [];

  const source = Array.isArray(value) ? value : [value];
  const flattened = source.flatMap((item) => (typeof item === "string" ? tokenizeCriteriaValue(item) : []));
  return Array.from(new Set(flattened)).sort((a, b) => a.localeCompare(b));
}

function hasAnyCriteriaInput(input: RecommendationCriteriaInput): boolean {
  const query = typeof input.query === "string" ? input.query.trim() : "";
  if (query.length > 0) return true;

  const lists = [input.mustHave, input.prefer, input.exclude];
  return lists.some((list) => normalizeList(list).length > 0);
}

export function validateRecommendationCriteria(input: RecommendationCriteriaInput): RecommendationValidationResult {
  const issues: RecommendationValidationIssue[] = [];

  if (input.query !== undefined && typeof input.query !== "string") {
    issues.push({
      code: RECOMMENDATION_ERROR_CODES.INVALID_QUERY,
      field: "query",
      message: "query must be a string",
    });
  }

  if (input.mustHave !== undefined && !(typeof input.mustHave === "string" || Array.isArray(input.mustHave))) {
    issues.push({
      code: RECOMMENDATION_ERROR_CODES.INVALID_MUST_HAVE,
      field: "mustHave",
      message: "mustHave must be a string or string[]",
    });
  }

  if (input.prefer !== undefined && !(typeof input.prefer === "string" || Array.isArray(input.prefer))) {
    issues.push({
      code: RECOMMENDATION_ERROR_CODES.INVALID_PREFER,
      field: "prefer",
      message: "prefer must be a string or string[]",
    });
  }

  if (input.exclude !== undefined && !(typeof input.exclude === "string" || Array.isArray(input.exclude))) {
    issues.push({
      code: RECOMMENDATION_ERROR_CODES.INVALID_EXCLUDE,
      field: "exclude",
      message: "exclude must be a string or string[]",
    });
  }

  if (issues.length === 0 && !hasAnyCriteriaInput(input)) {
    issues.push({
      code: RECOMMENDATION_ERROR_CODES.EMPTY_CRITERIA,
      field: "query",
      message: "at least one criteria value is required",
    });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function normalizeRecommendationCriteria(input: RecommendationCriteriaInput): NormalizedRecommendationCriteria {
  const query = (input.query ?? "").trim().toLowerCase();
  return {
    query,
    queryTokens: query ? Array.from(new Set(tokenizeCriteriaValue(query.replace(/\s+/g, ",")))).sort((a, b) => a.localeCompare(b)) : [],
    mustHave: normalizeList(input.mustHave),
    prefer: normalizeList(input.prefer),
    exclude: normalizeList(input.exclude),
  };
}

function countMatches(haystack: string, needles: string[]): number {
  let count = 0;
  for (const needle of needles) {
    if (haystack.includes(needle)) {
      count += 1;
    }
  }
  return count;
}

function clampScore(value: number): number {
  return Number(value.toFixed(6));
}

function buildSearchText(skill: MarketplaceResult): string {
  return `${skill.name} ${skill.scopedName} ${skill.description} ${skill.author}`.toLowerCase();
}

export function scoreSkillRecommendation(
  skill: MarketplaceResult,
  criteria: NormalizedRecommendationCriteria,
  options: RecommendationOptions = {},
): RankedSkillRecommendation {
  const weights = { ...DEFAULT_WEIGHTS, ...options.weights };
  const modernMarkers = (options.modernMarkers ?? DEFAULT_MODERN_MARKERS).map((marker) => marker.toLowerCase());
  const legacyMarkers = (options.legacyMarkers ?? DEFAULT_LEGACY_MARKERS).map((marker) => marker.toLowerCase());
  const text = buildSearchText(skill);
  const reasons: RecommendationReason[] = [];

  const mustHaveMatches = countMatches(text, criteria.mustHave);
  const missingMustHave = Math.max(criteria.mustHave.length - mustHaveMatches, 0);
  const preferMatches = countMatches(text, criteria.prefer);
  const queryMatches = countMatches(text, criteria.queryTokens);
  const excludeMatches = countMatches(text, criteria.exclude);
  const modernMatches = countMatches(text, modernMarkers);
  const legacyMatches = countMatches(text, legacyMarkers);
  const metadataSignal = skill.description.trim().length >= 80 ? 1 : 0;
  const starsSignal = Math.log10(skill.stars + 1);

  const mustHaveScore = (mustHaveMatches * weights.mustHaveMatch) - (missingMustHave * weights.missingMustHavePenalty);
  const preferScore = preferMatches * weights.preferMatch;
  const queryScore = queryMatches * weights.queryTokenMatch;
  const starsScore = starsSignal * weights.starsFactor;
  const metadataScore = metadataSignal * weights.metadataBoost;
  const modernityScore =
    (modernMatches * weights.modernMarkerBoost) - (legacyMatches * weights.legacyMarkerPenalty);
  const exclusionPenalty = excludeMatches * weights.excludePenalty;

  const total = clampScore(
    mustHaveScore + preferScore + queryScore + starsScore + metadataScore + modernityScore - exclusionPenalty,
  );

  if (mustHaveMatches > 0) reasons.push({ code: "MUST_HAVE_MATCH", detail: String(mustHaveMatches) });
  if (missingMustHave > 0) reasons.push({ code: "MISSING_MUST_HAVE", detail: String(missingMustHave) });
  if (preferMatches > 0) reasons.push({ code: "PREFER_MATCH", detail: String(preferMatches) });
  if (queryMatches > 0) reasons.push({ code: "QUERY_MATCH", detail: String(queryMatches) });
  if (starsSignal > 0) reasons.push({ code: "STAR_SIGNAL" });
  if (metadataSignal > 0) reasons.push({ code: "METADATA_SIGNAL" });
  if (modernMatches > 0) reasons.push({ code: "MODERN_MARKER", detail: String(modernMatches) });
  if (legacyMatches > 0) reasons.push({ code: "LEGACY_MARKER", detail: String(legacyMatches) });
  if (excludeMatches > 0) reasons.push({ code: "EXCLUDE_MATCH", detail: String(excludeMatches) });

  const result: RankedSkillRecommendation = {
    skill,
    score: total,
    reasons,
    excluded: excludeMatches > 0,
  };

  if (options.includeDetails) {
    result.breakdown = {
      mustHave: clampScore(mustHaveScore),
      prefer: clampScore(preferScore),
      query: clampScore(queryScore),
      stars: clampScore(starsScore),
      metadata: clampScore(metadataScore),
      modernity: clampScore(modernityScore),
      exclusionPenalty: clampScore(exclusionPenalty),
      total,
    };
  }

  return result;
}

export function recommendSkills(
  skills: MarketplaceResult[],
  criteriaInput: RecommendationCriteriaInput,
  options: RecommendationOptions = {},
): RecommendSkillsResult {
  const validation = validateRecommendationCriteria(criteriaInput);
  if (!validation.valid) {
    const first = validation.issues[0];
    const error = new Error(first?.message ?? "Invalid recommendation criteria") as Error & {
      code?: RecommendationErrorCode;
      issues?: RecommendationValidationIssue[];
    };
    error.code = first?.code;
    error.issues = validation.issues;
    throw error;
  }

  const criteria = normalizeRecommendationCriteria(criteriaInput);
  const ranking = skills
    .map((skill) => scoreSkillRecommendation(skill, criteria, options))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.skill.stars !== a.skill.stars) return b.skill.stars - a.skill.stars;
      return a.skill.scopedName.localeCompare(b.skill.scopedName);
    });

  return {
    criteria,
    ranking: typeof options.top === "number" ? ranking.slice(0, Math.max(0, options.top)) : ranking,
  };
}
