/**
 * Unified marketplace client
 *
 * Aggregates results from multiple marketplace adapters,
 * deduplicates, and sorts by relevance.
 */

import type { MarketplaceAdapter, MarketplaceResult } from "./types.js";
import { SkillsMPAdapter } from "./skillsmp.js";
import { SkillsShAdapter } from "./skillssh.js";

export class MarketplaceClient {
  private adapters: MarketplaceAdapter[];

  constructor(adapters?: MarketplaceAdapter[]) {
    this.adapters = adapters ?? [
      new SkillsMPAdapter(),
      new SkillsShAdapter(),
    ];
  }

  /** Search all marketplaces and deduplicate results */
  async search(query: string, limit = 20): Promise<MarketplaceResult[]> {
    // Query all adapters in parallel
    const promises = this.adapters.map((adapter) =>
      adapter.search(query, limit).catch(() => [] as MarketplaceResult[]),
    );

    const allResults = await Promise.all(promises);
    const flat = allResults.flat();

    // Deduplicate by scopedName, keeping higher star count
    const seen = new Map<string, MarketplaceResult>();
    for (const result of flat) {
      const existing = seen.get(result.scopedName);
      if (!existing || result.stars > existing.stars) {
        seen.set(result.scopedName, result);
      }
    }

    // Sort by stars descending
    const deduplicated = Array.from(seen.values());
    deduplicated.sort((a, b) => b.stars - a.stars);

    return deduplicated.slice(0, limit);
  }

  /** Get a specific skill by scoped name */
  async getSkill(scopedName: string): Promise<MarketplaceResult | null> {
    for (const adapter of this.adapters) {
      const result = await adapter.getSkill(scopedName).catch(() => null);
      if (result) return result;
    }
    return null;
  }
}
