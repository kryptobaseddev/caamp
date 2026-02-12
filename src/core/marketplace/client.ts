/**
 * Unified marketplace client
 *
 * Aggregates results from multiple marketplace adapters,
 * deduplicates, and sorts by relevance.
 */

import type { MarketplaceAdapter, MarketplaceResult } from "./types.js";
import { SkillsMPAdapter } from "./skillsmp.js";
import { SkillsShAdapter } from "./skillssh.js";

/**
 * Unified marketplace client that aggregates results from multiple marketplace adapters.
 *
 * Queries all configured marketplaces in parallel, deduplicates results by scoped name,
 * and sorts by star count.
 *
 * @example
 * ```typescript
 * const client = new MarketplaceClient();
 * const results = await client.search("filesystem");
 * for (const r of results) {
 *   console.log(`${r.scopedName} (${r.stars} stars)`);
 * }
 * ```
 */
export class MarketplaceClient {
  private adapters: MarketplaceAdapter[];

  /**
   * Create a new marketplace client.
   *
   * @param adapters - Custom marketplace adapters (defaults to agentskills.in and skills.sh)
   *
   * @example
   * ```typescript
   * // Use default adapters
   * const client = new MarketplaceClient();
   *
   * // Use custom adapters
   * const client = new MarketplaceClient([myAdapter]);
   * ```
   */
  constructor(adapters?: MarketplaceAdapter[]) {
    this.adapters = adapters ?? [
      new SkillsMPAdapter(),
      new SkillsShAdapter(),
    ];
  }

  /**
   * Search all marketplaces and return deduplicated, sorted results.
   *
   * Queries all adapters in parallel and deduplicates by `scopedName`,
   * keeping the entry with the highest star count. Results are sorted by
   * stars descending.
   *
   * @param query - Search query string
   * @param limit - Maximum number of results to return (default: 20)
   * @returns Deduplicated and sorted marketplace results
   *
   * @example
   * ```typescript
   * const results = await client.search("code review", 10);
   * ```
   */
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

  /**
   * Get a specific skill by its scoped name from any marketplace.
   *
   * Tries each adapter in order and returns the first match.
   *
   * @param scopedName - Scoped skill name (e.g. `"@author/my-skill"`)
   * @returns The marketplace result, or `null` if not found in any marketplace
   *
   * @example
   * ```typescript
   * const skill = await client.getSkill("@anthropic/memory");
   * ```
   */
  async getSkill(scopedName: string): Promise<MarketplaceResult | null> {
    for (const adapter of this.adapters) {
      const result = await adapter.getSkill(scopedName).catch(() => null);
      if (result) return result;
    }
    return null;
  }
}
