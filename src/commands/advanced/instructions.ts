/**
 * advanced instructions command
 */

import type { Command } from "commander";
import {
  selectProvidersByMinimumPriority,
  updateInstructionsSingleOperation,
} from "../../core/advanced/orchestration.js";
import { parsePriority, readTextInput, resolveProviders } from "./common.js";
import { LAFSCommandError, runLafsCommand } from "./lafs.js";

export function registerAdvancedInstructions(parent: Command): void {
  parent
    .command("instructions")
    .description("Single-operation instruction update across providers")
    .option("-a, --agent <name>", "Target specific provider(s)", (v, prev: string[]) => [...prev, v], [])
    .option("--all", "Use all registry providers (not only detected)")
    .option("--min-tier <tier>", "Minimum priority tier: high|medium|low", "low")
    .option("--scope <scope>", "Instruction scope: project|global", "project")
    .option("--content <text>", "Inline content to inject")
    .option("--content-file <path>", "File containing content to inject")
    .option("--project-dir <path>", "Project directory to resolve project-scope paths")
    .option("--details", "Include detailed per-file actions")
    .action(async (opts: {
      agent: string[];
      all?: boolean;
      minTier: string;
      scope: string;
      content?: string;
      contentFile?: string;
      projectDir?: string;
      details?: boolean;
    }) => runLafsCommand("advanced.instructions", !opts.details, async () => {
      const minimumPriority = parsePriority(opts.minTier);
      const baseProviders = resolveProviders({ all: opts.all, agent: opts.agent });
      const providers = selectProvidersByMinimumPriority(baseProviders, minimumPriority);

      const scope = opts.scope === "global" ? "global" : opts.scope === "project" ? "project" : null;
      if (!scope) {
        throw new LAFSCommandError(
          "E_ADVANCED_VALIDATION_SCOPE",
          `Invalid scope: ${opts.scope}`,
          "Use --scope project or --scope global.",
        );
      }

      const content = await readTextInput(opts.content, opts.contentFile);
      if (!content || content.trim().length === 0) {
        throw new LAFSCommandError(
          "E_ADVANCED_VALIDATION_CONTENT",
          "Instruction content is required.",
          "Provide --content or --content-file with non-empty text.",
        );
      }

      if (providers.length === 0) {
        throw new LAFSCommandError(
          "E_ADVANCED_NO_TARGET_PROVIDERS",
          "No target providers resolved for instruction update.",
          "Use --all or pass provider IDs with --agent.",
        );
      }

      const summary = await updateInstructionsSingleOperation(
        providers,
        content,
        scope,
        opts.projectDir,
      );

      return {
        objective: "Update instruction files across providers in one operation",
        constraints: {
          scope,
          minimumPriority,
          providerCount: providers.length,
        },
        acceptanceCriteria: {
          updatedFiles: summary.updatedFiles,
        },
        data: opts.details
          ? summary
          : {
            updatedFiles: summary.updatedFiles,
            files: summary.actions.map((entry) => ({
              file: entry.file,
              action: entry.action,
            })),
          },
      };
    }));
}
