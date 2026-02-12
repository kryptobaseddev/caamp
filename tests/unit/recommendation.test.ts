import { describe, it, expect } from "vitest";
import {
  RECOMMENDATION_ERROR_CODES,
  normalizeRecommendationCriteria,
  recommendSkills,
  scoreSkillRecommendation,
  validateRecommendationCriteria,
} from "../../src/core/skills/recommendation.js";
import type { MarketplaceResult } from "../../src/core/marketplace/types.js";

function makeSkill(overrides: Partial<MarketplaceResult> & { scopedName: string }): MarketplaceResult {
  return {
    name: overrides.scopedName.split("/").pop() ?? "skill",
    description: "A useful skill for testing recommendation ranking behavior with enough detail for scoring.",
    author: "tester",
    stars: 0,
    githubUrl: "https://github.com/test/repo",
    repoFullName: "test/repo",
    path: "",
    source: "test",
    ...overrides,
  };
}

describe("skills recommendation criteria parsing", () => {
  it("normalizes query and list criteria deterministically", () => {
    const normalized = normalizeRecommendationCriteria({
      query: "  Svelte   LAFS  ",
      mustHave: ["lafs, security", "Security", "svelte"],
      prefer: "typed,docs",
      exclude: ["legacy", "legacy,deprecated"],
    });

    expect(normalized).toEqual({
      query: "svelte   lafs",
      queryTokens: ["lafs", "svelte"],
      mustHave: ["lafs", "security", "svelte"],
      prefer: ["docs", "typed"],
      exclude: ["deprecated", "legacy"],
    });
  });

  it("returns stable validation error code for empty criteria", () => {
    const result = validateRecommendationCriteria({});
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.code).toBe(RECOMMENDATION_ERROR_CODES.EMPTY_CRITERIA);
  });

  it("returns stable validation error code for invalid field type", () => {
    const result = validateRecommendationCriteria({ mustHave: 42 as unknown as string[] });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.code).toBe(RECOMMENDATION_ERROR_CODES.INVALID_MUST_HAVE);
  });
});

describe("skills recommendation scoring and ranking", () => {
  it("scores deterministically for identical input", () => {
    const skill = makeSkill({
      scopedName: "@demo/modern-svelte",
      description: "Svelte 5 runes and LAFS-aware recommendation helper for docs and typed workflows.",
      stars: 200,
    });

    const criteria = normalizeRecommendationCriteria({
      query: "svelte lafs",
      mustHave: "svelte",
      prefer: "typed",
      exclude: "jquery",
    });

    const first = scoreSkillRecommendation(skill, criteria, { includeDetails: true });
    const second = scoreSkillRecommendation(skill, criteria, { includeDetails: true });

    expect(first.score).toBe(second.score);
    expect(first.reasons).toEqual(second.reasons);
    expect(first.breakdown).toEqual(second.breakdown);
  });

  it("uses deterministic tie-breakers when scores are equal", () => {
    const a = makeSkill({ scopedName: "@z/skill-z", stars: 20, description: "same score text" });
    const b = makeSkill({ scopedName: "@a/skill-a", stars: 20, description: "same score text" });
    const c = makeSkill({ scopedName: "@m/skill-m", stars: 5, description: "same score text" });

    const result = recommendSkills([a, b, c], { query: "same" });
    expect(result.ranking.map((entry) => entry.skill.scopedName)).toEqual([
      "@a/skill-a",
      "@z/skill-z",
      "@m/skill-m",
    ]);
  });

  it("includes reason codes and exclusion penalties", () => {
    const modern = makeSkill({
      scopedName: "@demo/modern",
      description: "Svelte 5 runes modern approach for typed docs and integrations.",
      stars: 40,
    });
    const legacy = makeSkill({
      scopedName: "@demo/legacy",
      description: "Legacy jquery plugin helper for old workflows.",
      stars: 40,
    });

    const result = recommendSkills(
      [legacy, modern],
      {
        query: "typed docs",
        prefer: "typed",
        exclude: "jquery",
      },
      { includeDetails: true },
    );

    expect(result.ranking[0]?.skill.scopedName).toBe("@demo/modern");
    expect(result.ranking[0]?.reasons.some((reason) => reason.code === "MODERN_MARKER")).toBe(true);
    expect(result.ranking[1]?.reasons.some((reason) => reason.code === "EXCLUDE_MATCH")).toBe(true);
    expect(result.ranking[1]?.excluded).toBe(true);
    expect(result.ranking[1]?.breakdown?.exclusionPenalty).toBeGreaterThan(0);
  });

  it("throws validation error with code and issues", () => {
    expect(() => recommendSkills([], {})).toThrowError(expect.objectContaining({ code: RECOMMENDATION_ERROR_CODES.EMPTY_CRITERIA }));
  });
});
