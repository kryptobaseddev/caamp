/**
 * advanced providers command
 */

import { Command } from "commander";
import { selectProvidersByMinimumPriority } from "../../core/advanced/orchestration.js";
import { parsePriority, resolveProviders } from "./common.js";
import { runLafsCommand } from "./lafs.js";

export function registerAdvancedProviders(parent: Command): void {
  parent
    .command("providers")
    .description("Select providers by priority using advanced wrapper logic")
    .option("-a, --agent <name>", "Target specific provider(s)", (v, prev: string[]) => [...prev, v], [])
    .option("--all", "Use all registry providers (not only detected)")
    .option("--min-tier <tier>", "Minimum priority tier: high|medium|low", "low")
    .option("--details", "Include full provider objects")
    .action(async (opts: {
      agent: string[];
      all?: boolean;
      minTier: string;
      details?: boolean;
    }) => runLafsCommand("advanced.providers", !opts.details, async () => {
      const providers = resolveProviders({ all: opts.all, agent: opts.agent });
      const minTier = parsePriority(opts.minTier);
      const selected = selectProvidersByMinimumPriority(providers, minTier);

      return {
        objective: "Filter providers by minimum priority tier",
        constraints: {
          minTier,
          selectionMode: opts.all ? "registry" : "detected-or-explicit",
        },
        acceptanceCriteria: {
          selectedCount: selected.length,
          orderedByPriority: true,
        },
        data: opts.details
          ? selected
          : selected.map((provider) => ({
            id: provider.id,
            priority: provider.priority,
            status: provider.status,
            configFormat: provider.configFormat,
          })),
      };
    }));
}
