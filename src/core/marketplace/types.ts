/**
 * Marketplace types shared between adapters
 */

export interface MarketplaceAdapter {
  name: string;
  search(query: string, limit?: number): Promise<MarketplaceResult[]>;
  getSkill(scopedName: string): Promise<MarketplaceResult | null>;
}

/**
 * Normalized marketplace record returned by all adapters.
 *
 * This model captures a single skill listing with enough information
 * for search display and install resolution to GitHub sources.
 */
export interface MarketplaceResult {
  name: string;
  scopedName: string;
  description: string;
  author: string;
  stars: number;
  githubUrl: string;
  repoFullName: string;
  path: string;
  source: string; // which marketplace it came from
}

export interface SearchOptions {
  query: string;
  limit?: number;
  offset?: number;
  sortBy?: "stars" | "recent" | "name";
  category?: string;
  author?: string;
}
