/**
 * skills install command
 */

import { Command } from "commander";
import { existsSync } from "node:fs";
import pc from "picocolors";
import { parseSource, isMarketplaceScoped } from "../../core/sources/parser.js";
import { installSkill } from "../../core/skills/installer.js";
import { recordSkillInstall } from "../../core/skills/lock.js";
import { getInstalledProviders } from "../../core/registry/detection.js";
import { getProvider } from "../../core/registry/providers.js";
import { cloneRepo } from "../../core/sources/github.js";
import { cloneGitLabRepo } from "../../core/sources/gitlab.js";
import { MarketplaceClient } from "../../core/marketplace/client.js";
import { formatNetworkError } from "../../core/network/fetch.js";
import { buildSkillSubPathCandidates } from "../../core/paths/standard.js";
import type { MarketplaceResult } from "../../core/marketplace/types.js";
import type { Provider, SourceType } from "../../types.js";

export function registerSkillsInstall(parent: Command): void {
  parent
    .command("install")
    .description("Install a skill from GitHub, URL, or marketplace")
    .argument("<source>", "Skill source (GitHub URL, owner/repo, @author/name)")
    .option("-a, --agent <name>", "Target specific agent(s)", (v, prev: string[]) => [...prev, v], [])
    .option("-g, --global", "Install globally")
    .option("-y, --yes", "Skip confirmation")
    .option("--all", "Install to all detected agents")
    .action(async (source: string, opts: {
      agent: string[];
      global?: boolean;
      yes?: boolean;
      all?: boolean;
    }) => {
      // Determine target providers
      let providers: Provider[];

      if (opts.all) {
        providers = getInstalledProviders();
      } else if (opts.agent.length > 0) {
        providers = opts.agent
          .map((a) => getProvider(a))
          .filter((p): p is Provider => p !== undefined);
      } else {
        providers = getInstalledProviders();
      }

      if (providers.length === 0) {
        console.error(pc.red("No target providers found. Use --agent or --all."));
        process.exit(1);
      }

      console.log(pc.dim(`Installing to ${providers.length} provider(s)...`));

      let localPath: string | undefined;
      let cleanup: (() => Promise<void>) | undefined;
      let skillName: string;
      let sourceValue: string;
      let sourceType: SourceType;

      // Handle marketplace scoped names
      if (isMarketplaceScoped(source)) {
        console.log(pc.dim(`Searching marketplace for ${source}...`));
        const client = new MarketplaceClient();
        let skill: MarketplaceResult | null;

        try {
          skill = await client.getSkill(source);
        } catch (error) {
          console.error(pc.red(`Marketplace lookup failed: ${formatNetworkError(error)}`));
          process.exit(1);
        }

        if (!skill) {
          console.error(pc.red(`Skill not found: ${source}`));
          process.exit(1);
        }

        console.log(`  Found: ${pc.bold(skill.name)} by ${skill.author} (${pc.dim(skill.repoFullName)})`);

        const parsed = parseSource(skill.githubUrl);
        if (parsed.type !== "github" || !parsed.owner || !parsed.repo) {
          console.error(pc.red("Could not resolve GitHub source"));
          process.exit(1);
        }

        try {
          const subPathCandidates = buildSkillSubPathCandidates(skill.path, parsed.path);
          let cloneError: unknown;
          let cloned = false;

          for (const subPath of subPathCandidates) {
            try {
              const result = await cloneRepo(parsed.owner, parsed.repo, parsed.ref, subPath);
              if (subPath && !existsSync(result.localPath)) {
                await result.cleanup();
                continue;
              }
              localPath = result.localPath;
              cleanup = result.cleanup;
              cloned = true;
              break;
            } catch (error) {
              cloneError = error;
            }
          }

          if (!cloned) {
            throw cloneError ?? new Error("Unable to resolve skill path from marketplace metadata");
          }

          skillName = skill.name;
          sourceValue = skill.githubUrl;
          sourceType = parsed.type;
        } catch (error) {
          console.error(pc.red(`Failed to fetch source repository: ${formatNetworkError(error)}`));
          process.exit(1);
        }
      } else {
        // Parse source
        const parsed = parseSource(source);
        skillName = parsed.inferredName;
        sourceValue = parsed.value;
        sourceType = parsed.type;

        if (parsed.type === "github" && parsed.owner && parsed.repo) {
          try {
            const result = await cloneRepo(parsed.owner, parsed.repo, parsed.ref, parsed.path);
            localPath = result.localPath;
            cleanup = result.cleanup;
          } catch (error) {
            console.error(pc.red(`Failed to clone GitHub repository: ${formatNetworkError(error)}`));
            process.exit(1);
          }
        } else if (parsed.type === "gitlab" && parsed.owner && parsed.repo) {
          try {
            const result = await cloneGitLabRepo(parsed.owner, parsed.repo, parsed.ref, parsed.path);
            localPath = result.localPath;
            cleanup = result.cleanup;
          } catch (error) {
            console.error(pc.red(`Failed to clone GitLab repository: ${formatNetworkError(error)}`));
            process.exit(1);
          }
        } else if (parsed.type === "local") {
          localPath = parsed.value;
        } else {
          console.error(pc.red(`Unsupported source type: ${parsed.type}`));
          process.exit(1);
        }
      }

      try {
        if (!localPath) {
          throw new Error("No local skill path resolved for installation");
        }

        const result = await installSkill(
          localPath,
          skillName,
          providers,
          opts.global ?? false,
        );

        if (result.success) {
          console.log(pc.green(`\n✓ Installed ${pc.bold(skillName)}`));
          console.log(`  Canonical: ${pc.dim(result.canonicalPath)}`);
          console.log(`  Linked to: ${result.linkedAgents.join(", ")}`);

          // Record in lock file
          await recordSkillInstall(
            skillName,
            source,
            sourceValue,
            sourceType,
            result.linkedAgents,
            result.canonicalPath,
            opts.global ?? false,
          );
        }

        if (result.errors.length > 0) {
          console.log(pc.yellow("\nWarnings:"));
          for (const err of result.errors) {
            console.log(`  ${pc.yellow("!")} ${err}`);
          }
        }
      } finally {
        if (cleanup) await cleanup();
      }
    });
}
