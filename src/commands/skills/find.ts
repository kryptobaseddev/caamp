/**
 * skills find command - marketplace search + recommendation mode
 */

import { randomUUID } from "node:crypto";
import { Command } from "commander";
import {
  resolveOutputFormat,
  type LAFSErrorCategory,
} from "@cleocode/lafs-protocol";
import pc from "picocolors";
import { MarketplaceClient } from "../../core/marketplace/client.js";
import { formatNetworkError } from "../../core/network/fetch.js";
import type { MarketplaceResult } from "../../core/marketplace/types.js";
import {
  recommendSkills,
  tokenizeCriteriaValue,
  type RankedSkillRecommendation,
} from "../../core/skills/recommendation.js";

interface SkillsFindOptions {
  json?: boolean;
  human?: boolean;
  limit: string;
  recommend?: boolean;
  top: string;
  details?: boolean;
  mustHave: string[];
  prefer: string[];
  exclude: string[];
  select?: string;
}

interface LAFSErrorShape {
  code: string;
  message: string;
  category: LAFSErrorCategory;
  retryable: boolean;
  retryAfterMs: number | null;
  details: Record<string, unknown>;
}

class SkillsFindValidationError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "SkillsFindValidationError";
  }
}

interface RecommendationOption {
  rank: number;
  scopedName: string;
  description: string;
  score: number;
  why: string;
  source: string;
  evidence?: {
    reasons: RankedSkillRecommendation["reasons"];
    breakdown?: RankedSkillRecommendation["breakdown"];
  };
}

export function registerSkillsFind(parent: Command): void {
  parent
    .command("find")
    .description("Search marketplace for skills")
    .argument("[query]", "Search query")
    .option("--recommend", "Recommend skills from constraints")
    .option("--top <n>", "Number of recommendation candidates", "5")
    .option("--must-have <term>", "Required criteria term", (value, previous: string[]) => [...previous, value], [])
    .option("--prefer <term>", "Preferred criteria term", (value, previous: string[]) => [...previous, value], [])
    .option("--exclude <term>", "Excluded criteria term", (value, previous: string[]) => [...previous, value], [])
    .option("--details", "Include expanded machine output")
    .option("--human", "Force human-readable output")
    .option("--json", "Output as JSON")
    .option("--select <indexes>", "Pre-select recommendation ranks (comma-separated)")
    .option("-l, --limit <n>", "Max results", "20")
    .action(async (query: string | undefined, opts: SkillsFindOptions) => {
      const operation = opts.recommend ? "skills.find.recommend" : "skills.find.search";
      const details = Boolean(opts.details);
      const mvi = !details;

      let format: "json" | "human";
      try {
        format = resolveOutputFormat({
          jsonFlag: opts.json ?? false,
          humanFlag: opts.human ?? false,
          projectDefault: opts.recommend ? "json" : "human",
        }).format;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (opts.json) {
          emitJsonError(operation, mvi, "E_FORMAT_CONFLICT", message, "VALIDATION");
        } else {
          console.error(pc.red(message));
        }
        process.exit(1);
      }

      if (opts.recommend) {
        try {
          const top = parseTop(opts.top);
          const mustHave = parseConstraintList(opts.mustHave);
          const prefer = parseConstraintList(opts.prefer);
          const exclude = parseConstraintList(opts.exclude);
          validateCriteriaConflicts(mustHave, prefer, exclude);
          const selectedRanks = parseSelectList(opts.select);
          if (format === "json" && selectedRanks.length > 0) {
            throw new SkillsFindValidationError(
              "E_SKILLS_FIND_VALIDATION_SELECT_MODE",
              "--select is only supported in human output mode.",
            );
          }
          const seedQuery = buildSeedQuery(query, mustHave, prefer, exclude);

          const client = new MarketplaceClient();
          const searchLimit = Math.max(top * 5, 20);
          const results = await client.search(seedQuery, searchLimit);
          const recommendation = recommendSkills(
            results,
            {
              query,
              mustHave,
              prefer,
              exclude,
            },
            {
              top,
              includeDetails: details,
            },
          );
          const options = normalizeRecommendationOptions(recommendation.ranking, details);
          validateSelectedRanks(selectedRanks, options.length);
          const selected = selectedRanks.length > 0
            ? options.filter((option) => selectedRanks.includes(option.rank))
            : [];

          if (format === "json") {
            const envelope = buildEnvelope(
              operation,
              mvi,
              makeMachineResult(options, selected, details),
              null,
            );
            console.log(JSON.stringify(envelope, null, 2));
            return;
          }

          renderHumanRecommendations(options);
          return;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const errorCode =
            error instanceof SkillsFindValidationError ? error.code : "E_RECOMMENDATION_FAILED";
          const category: LAFSErrorCategory = error instanceof SkillsFindValidationError
            ? error.code.includes("CONFLICT")
              ? "CONFLICT"
              : "VALIDATION"
            : "INTERNAL";
          if (format === "json") {
            emitJsonError(operation, mvi, errorCode, message, category, {
              query: query ?? null,
            });
          } else {
            console.error(pc.red(`Recommendation failed: ${message}`));
          }
          process.exit(1);
        }
      }

      if (!query) {
        console.log(pc.dim("Usage: caamp skills find <query>"));
        return;
      }

      const limit = parseInt(opts.limit, 10);
      const client = new MarketplaceClient();

      if (format === "human") {
        console.log(pc.dim(`Searching marketplaces for "${query}"...\n`));
      }

      let results: MarketplaceResult[];
      try {
        results = await client.search(query, limit);
      } catch (error) {
        const message = formatNetworkError(error);
        if (format === "json") {
          console.log(JSON.stringify({ error: message }));
        } else {
          console.error(pc.red(`Marketplace search failed: ${message}`));
        }
        process.exit(1);
      }

      if (format === "json") {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      if (results.length === 0) {
        console.log(pc.yellow("No results found."));
        return;
      }

      for (const skill of results) {
        const stars = skill.stars > 0 ? pc.yellow(`★ ${formatStars(skill.stars)}`) : "";
        console.log(`  ${pc.bold(skill.scopedName.padEnd(35))} ${stars}`);
        console.log(`  ${pc.dim(skill.description?.slice(0, 80) ?? "")}`);
        console.log(`  ${pc.dim(`from ${skill.source}`)}`);
        console.log();
      }

      console.log(pc.dim("Install with: caamp skills install <scopedName>"));
    });
}

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function renderHumanRecommendations(options: RecommendationOption[]): void {
  if (options.length === 0) {
    console.log(pc.yellow("No recommendations found."));
    return;
  }

  console.log(pc.bold("Recommended skills:\n"));
  for (const option of options) {
    const marker = option.rank === 1 ? ` ${pc.green("(Recommended)")}` : "";
    console.log(`  ${pc.cyan(`${option.rank}.`)} ${pc.bold(option.scopedName)}${marker} ${pc.dim(`score ${option.score.toFixed(3)}`)}`);
    if (option.why) {
      console.log(`     ${pc.dim(option.why)}`);
    }
    if (option.description) {
      console.log(`     ${pc.dim(option.description)}`);
    }
    console.log();
  }

  console.log(`CHOOSE: ${options.map((option) => option.rank).join(",")}`);
}

function makeMachineResult(
  options: RecommendationOption[],
  selected: RecommendationOption[],
  details: boolean,
): Record<string, unknown> {
  const choose = options.map((option) => option.rank).join(",");
  if (!details) {
    return {
      options: options.map((option) => ({
        rank: option.rank,
        scopedName: option.scopedName,
        score: option.score,
        why: option.why,
      })),
      choose,
      selected: selected.map((option) => option.scopedName),
    };
  }

  return {
    options,
    choose,
    selected,
  };
}

function parseConstraintList(values: string[]): string[] {
  const normalized = values.flatMap((value) => tokenizeCriteriaValue(value));
  return Array.from(new Set(normalized));
}

function parseTop(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20) {
    throw new SkillsFindValidationError("E_SKILLS_FIND_VALIDATION_TOP", "--top must be an integer between 1 and 20");
  }
  return parsed;
}

function parseSelectList(value: string | undefined): number[] {
  if (!value) return [];
  const parsed = value
    .split(",")
    .map((entry) => Number.parseInt(entry.trim(), 10))
    .filter((entry) => Number.isInteger(entry) && entry > 0);
  return Array.from(new Set(parsed));
}

function buildSeedQuery(query: string | undefined, mustHave: string[], prefer: string[], exclude: string[]): string {
  if (query && query.trim().length > 0) {
    return query;
  }

  const seedTerms = [...mustHave, ...prefer, ...exclude].filter((term) => term.length > 0);
  if (seedTerms.length > 0) {
    return seedTerms.join(" ");
  }

  throw new SkillsFindValidationError(
    "E_SKILLS_FIND_VALIDATION_CRITERIA",
    "Recommendation mode requires a query or at least one criteria flag.",
  );
}

function normalizeRecommendationOptions(ranking: RankedSkillRecommendation[], details: boolean): RecommendationOption[] {
  return ranking.map((entry, index) => {
    const whyCodes = entry.reasons.map((reason) => reason.code);
    return {
      rank: index + 1,
      scopedName: entry.skill.scopedName,
      description: entry.skill.description,
      score: entry.score,
      why: whyCodes.length > 0 ? whyCodes.join(", ") : "score-based match",
      source: entry.skill.source,
      ...(details
        ? {
            evidence: {
              reasons: entry.reasons,
              breakdown: entry.breakdown,
            },
          }
        : {}),
    };
  });
}

function validateCriteriaConflicts(mustHave: string[], prefer: string[], exclude: string[]): void {
  const overlap = mustHave.filter((term) => exclude.includes(term));
  if (overlap.length > 0) {
    throw new SkillsFindValidationError(
      "E_SKILLS_FIND_CONFLICT_CRITERIA",
      "A criteria term cannot be both required and excluded.",
    );
  }

  const preferOverlap = prefer.filter((term) => exclude.includes(term));
  if (preferOverlap.length > 0) {
    throw new SkillsFindValidationError(
      "E_SKILLS_FIND_CONFLICT_CRITERIA",
      "A criteria term cannot be both preferred and excluded.",
    );
  }
}

function validateSelectedRanks(selectedRanks: number[], total: number): void {
  for (const rank of selectedRanks) {
    if (rank < 1 || rank > total) {
      throw new SkillsFindValidationError(
        "E_SKILLS_FIND_VALIDATION_SELECT_RANGE",
        `--select rank ${rank} is out of range (1-${total}).`,
      );
    }
  }
}

function buildEnvelope<T>(operation: string, mvi: boolean, result: T | null, error: LAFSErrorShape | null) {
  return {
    $schema: "https://lafs.dev/schemas/v1/envelope.schema.json" as const,
    _meta: {
      specVersion: "1.0.0",
      schemaVersion: "1.0.0",
      timestamp: new Date().toISOString(),
      operation,
      requestId: randomUUID(),
      transport: "cli" as const,
      strict: true,
      mvi,
      contextVersion: 0,
    },
    success: error === null,
    result,
    error,
    page: null,
  };
}

function emitJsonError(
  operation: string,
  mvi: boolean,
  code: string,
  message: string,
  category: LAFSErrorCategory,
  details: Record<string, unknown> = {},
): void {
  const envelope = buildEnvelope(operation, mvi, null, {
    code,
    message,
    category,
    retryable: false,
    retryAfterMs: null,
    details,
  });
  console.error(JSON.stringify(envelope, null, 2));
}
