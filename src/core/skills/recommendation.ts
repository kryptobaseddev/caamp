import type { MarketplaceResult } from "../marketplace/types.js";

export const RECOMMENDATION_ERROR_CODES = {
  QUERY_INVALID: "E_SKILLS_QUERY_INVALID",
  NO_MATCHES: "E_SKILLS_NO_MATCHES",
  SOURCE_UNAVAILABLE: "E_SKILLS_SOURCE_UNAVAILABLE",
  CRITERIA_CONFLICT: "E_SKILLS_CRITERIA_CONFLICT",
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
  | "MATCH_TOPIC_GITBOOK"
  | "HAS_GIT_SYNC"
  | "HAS_API_WORKFLOW"
  | "PENALTY_LEGACY_CLI"
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
  tradeoffs: string[];
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
const DEFAULT_LEGACY_MARKERS = ["svelte 3", "jquery", "bower", "legacy", "book.json", "gitbook-cli"];

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
      code: RECOMMENDATION_ERROR_CODES.QUERY_INVALID,
      field: "query",
      message: "query must be a string",
    });
  }

  if (input.mustHave !== undefined && !(typeof input.mustHave === "string" || Array.isArray(input.mustHave))) {
    issues.push({
      code: RECOMMENDATION_ERROR_CODES.QUERY_INVALID,
      field: "mustHave",
      message: "mustHave must be a string or string[]",
    });
  }

  if (input.prefer !== undefined && !(typeof input.prefer === "string" || Array.isArray(input.prefer))) {
    issues.push({
      code: RECOMMENDATION_ERROR_CODES.QUERY_INVALID,
      field: "prefer",
      message: "prefer must be a string or string[]",
    });
  }

  if (input.exclude !== undefined && !(typeof input.exclude === "string" || Array.isArray(input.exclude))) {
    issues.push({
      code: RECOMMENDATION_ERROR_CODES.QUERY_INVALID,
      field: "exclude",
      message: "exclude must be a string or string[]",
    });
  }

  const mustHave = normalizeList(input.mustHave);
  const prefer = normalizeList(input.prefer);
  const exclude = normalizeList(input.exclude);
  const conflict = mustHave.some((term) => exclude.includes(term)) || prefer.some((term) => exclude.includes(term));
  if (conflict) {
    issues.push({
      code: RECOMMENDATION_ERROR_CODES.CRITERIA_CONFLICT,
      field: "exclude",
      message: "criteria terms cannot appear in both prefer/must-have and exclude",
    });
  }

  if (issues.length === 0 && !hasAnyCriteriaInput(input)) {
    issues.push({
      code: RECOMMENDATION_ERROR_CODES.QUERY_INVALID,
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
  const tradeoffs: string[] = [];

  const mustHaveMatches = countMatches(text, criteria.mustHave);
  const missingMustHave = Math.max(criteria.mustHave.length - mustHaveMatches, 0);
  const preferMatches = countMatches(text, criteria.prefer);
  const queryMatches = countMatches(text, criteria.queryTokens);
  const excludeMatches = countMatches(text, criteria.exclude);
  const modernMatches = countMatches(text, modernMarkers);
  const legacyMatches = countMatches(text, legacyMarkers);
  const metadataSignal = skill.description.trim().length >= 80 ? 1 : 0;
  const starsSignal = Math.log10(skill.stars + 1);
  const sourceConfidence = skill.source === "agentskills.in"
    ? 1
    : skill.source === "skills.sh"
      ? 0.8
      : 0.6;

  const mustHaveScore = (mustHaveMatches * weights.mustHaveMatch) - (missingMustHave * weights.missingMustHavePenalty);
  const preferScore = preferMatches * weights.preferMatch;
  const queryScore = queryMatches * weights.queryTokenMatch;
  const starsScore = starsSignal * weights.starsFactor;
  const metadataScore = (metadataSignal + sourceConfidence) * weights.metadataBoost;
  const modernityScore =
    (modernMatches * weights.modernMarkerBoost) - (legacyMatches * weights.legacyMarkerPenalty);
  const exclusionPenalty = excludeMatches * weights.excludePenalty;

  const hasGitbookTopic = text.includes("gitbook");
  const hasGitSync = text.includes("git sync") || (text.includes("git") && text.includes("sync"));
  const hasApiWorkflow = text.includes("api") && (text.includes("workflow") || text.includes("sync"));
  const hasLegacyCli = text.includes("gitbook-cli") || text.includes("book.json");

  const topicScore = (hasGitbookTopic ? 3 : 0) + (hasGitSync ? 2 : 0) + (hasApiWorkflow ? 2 : 0) - (hasLegacyCli ? 4 : 0);

  const total = clampScore(
    mustHaveScore + preferScore + queryScore + starsScore + metadataScore + modernityScore + topicScore - exclusionPenalty,
  );

  if (hasGitbookTopic) reasons.push({ code: "MATCH_TOPIC_GITBOOK" });
  if (hasGitSync) reasons.push({ code: "HAS_GIT_SYNC" });
  if (hasApiWorkflow) reasons.push({ code: "HAS_API_WORKFLOW" });
  if (hasLegacyCli) reasons.push({ code: "PENALTY_LEGACY_CLI" });

  if (mustHaveMatches > 0) reasons.push({ code: "MUST_HAVE_MATCH", detail: String(mustHaveMatches) });
  if (missingMustHave > 0) reasons.push({ code: "MISSING_MUST_HAVE", detail: String(missingMustHave) });
  if (preferMatches > 0) reasons.push({ code: "PREFER_MATCH", detail: String(preferMatches) });
  if (queryMatches > 0) reasons.push({ code: "QUERY_MATCH", detail: String(queryMatches) });
  if (starsSignal > 0) reasons.push({ code: "STAR_SIGNAL" });
  if (metadataSignal > 0) reasons.push({ code: "METADATA_SIGNAL" });
  if (modernMatches > 0) reasons.push({ code: "MODERN_MARKER", detail: String(modernMatches) });
  if (legacyMatches > 0) reasons.push({ code: "LEGACY_MARKER", detail: String(legacyMatches) });
  if (excludeMatches > 0) reasons.push({ code: "EXCLUDE_MATCH", detail: String(excludeMatches) });

  if (missingMustHave > 0) tradeoffs.push("Missing one or more required criteria terms.");
  if (excludeMatches > 0) tradeoffs.push("Matches one or more excluded terms.");
  if (skill.stars < 10) tradeoffs.push("Low quality signal from repository stars.");
  if (hasLegacyCli) tradeoffs.push("Contains legacy GitBook CLI markers.");

  const result: RankedSkillRecommendation = {
    skill,
    score: total,
    reasons,
    tradeoffs,
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

export const rankSkills = recommendSkills;
