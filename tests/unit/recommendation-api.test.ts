import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  rankSkills: vi.fn(),
}));

vi.mock("../../src/core/marketplace/client.js", () => ({
  MarketplaceClient: class {
    search = mocks.search;
  },
}));

vi.mock("../../src/core/skills/recommendation.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/core/skills/recommendation.js")>("../../src/core/skills/recommendation.js");
  return {
    ...actual,
    recommendSkills: mocks.rankSkills,
  };
});

import {
  formatSkillRecommendations,
  recommendSkills,
  searchSkills,
} from "../../src/core/skills/recommendation-api.js";

describe("recommendation api surface", () => {
  beforeEach(() => {
    mocks.search.mockReset();
    mocks.rankSkills.mockReset();
  });

  it("searchSkills returns raw marketplace hits", async () => {
    mocks.search.mockResolvedValue([{ scopedName: "@a/skill" }]);
    const result = await searchSkills("gitbook", { limit: 5 });
    expect(mocks.search).toHaveBeenCalledWith("gitbook", 5);
    expect(result).toEqual([{ scopedName: "@a/skill" }]);
  });

  it("recommendSkills ranks query results", async () => {
    mocks.search.mockResolvedValue([{ scopedName: "@a/skill" }]);
    mocks.rankSkills.mockReturnValue({
      criteria: { query: "gitbook", queryTokens: ["gitbook"], mustHave: [], prefer: [], exclude: [] },
      ranking: [
        {
          skill: { scopedName: "@a/skill" },
          score: 1,
          reasons: [],
          tradeoffs: [],
          excluded: false,
        },
      ],
    });

    await recommendSkills("gitbook", { prefer: ["api"] }, { top: 3 });
    expect(mocks.rankSkills).toHaveBeenCalled();
  });

  it("formats human output with CHOOSE", () => {
    const output = formatSkillRecommendations(
      {
        criteria: { query: "gitbook", queryTokens: ["gitbook"], mustHave: [], prefer: [], exclude: [] },
        ranking: [
          {
            skill: {
              name: "gitbook",
              scopedName: "@demo/gitbook",
              description: "desc",
              author: "demo",
              stars: 100,
              githubUrl: "https://github.com/demo/gitbook",
              repoFullName: "demo/gitbook",
              path: "",
              source: "agentskills.in",
            },
            score: 10,
            reasons: [{ code: "MATCH_TOPIC_GITBOOK" }],
            tradeoffs: [],
            excluded: false,
          },
        ],
      },
      { mode: "human" },
    ) as string;

    expect(output).toContain("1) @demo/gitbook (Recommended)");
    expect(output).toContain("CHOOSE: 1");
  });
});
