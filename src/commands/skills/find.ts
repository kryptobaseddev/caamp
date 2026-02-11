/**
 * skills find command - marketplace search
 */

import { Command } from "commander";
import pc from "picocolors";
import { MarketplaceClient } from "../../core/marketplace/client.js";

export function registerSkillsFind(parent: Command): void {
  parent
    .command("find")
    .description("Search marketplace for skills")
    .argument("[query]", "Search query")
    .option("--json", "Output as JSON")
    .option("-l, --limit <n>", "Max results", "20")
    .action(async (query: string | undefined, opts: { json?: boolean; limit: string }) => {
      if (!query) {
        console.log(pc.dim("Usage: caamp skills find <query>"));
        return;
      }

      const limit = parseInt(opts.limit, 10);
      const client = new MarketplaceClient();

      console.log(pc.dim(`Searching marketplaces for "${query}"...\n`));

      const results = await client.search(query, limit);

      if (opts.json) {
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

      console.log(pc.dim(`Install with: caamp skills install <scopedName>`));
    });
}

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
