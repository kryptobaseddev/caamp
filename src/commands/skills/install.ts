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
import { discoverSkill } from "../../core/skills/discovery.js";
import * as catalog from "../../core/skills/catalog.js";
import type { MarketplaceResult } from "../../core/marketplace/types.js";
import type { Provider, SourceType } from "../../types.js";

export function registerSkillsInstall(parent: Command): void {
  parent
    .command("install")
    .description("Install a skill from GitHub, URL, marketplace, or ct-skills catalog")
    .argument("[source]", "Skill source (GitHub URL, owner/repo, @author/name, skill-name)")
    .option("-a, --agent <name>", "Target specific agent(s)", (v, prev: string[]) => [...prev, v], [])
    .option("-g, --global", "Install globally")
    .option("-y, --yes", "Skip confirmation")
    .option("--all", "Install to all detected agents")
    .option("--profile <name>", "Install a ct-skills profile (minimal, core, recommended, full)")
    .action(async (source: string | undefined, opts: {
      agent: string[];
      global?: boolean;
      yes?: boolean;
      all?: boolean;
      profile?: string;
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

      // Handle --profile: install an entire ct-skills profile
      if (opts.profile) {
        if (!catalog.isCatalogAvailable()) {
          console.error(pc.red("@cleocode/ct-skills is not installed. Run: npm install @cleocode/ct-skills"));
          process.exit(1);
        }

        const profileSkills = catalog.resolveProfile(opts.profile);
        if (profileSkills.length === 0) {
          const available = catalog.listProfiles();
          console.error(pc.red(`Profile not found: ${opts.profile}`));
          if (available.length > 0) {
            console.log(pc.dim("Available profiles: " + available.join(", ")));
          }
          process.exit(1);
        }

        console.log(`Installing profile ${pc.bold(opts.profile)} (${profileSkills.length} skill(s))...`);
        console.log(pc.dim(`Target: ${providers.length} provider(s)`));

        let installed = 0;
        let failed = 0;

        for (const name of profileSkills) {
          const skillDir = catalog.getSkillDir(name);
          try {
            const result = await installSkill(
              skillDir,
              name,
              providers,
              opts.global ?? false,
            );

            if (result.success) {
              console.log(pc.green(`  + ${name}`));
              await recordSkillInstall(
                name,
                `@cleocode/ct-skills:${name}`,
                `@cleocode/ct-skills:${name}`,
                "package",
                result.linkedAgents,
                result.canonicalPath,
                true,
              );
              installed++;
            } else {
              console.log(pc.yellow(`  ! ${name}: ${result.errors.join(", ")}`));
              failed++;
            }
          } catch (err) {
            console.log(pc.red(`  x ${name}: ${err instanceof Error ? err.message : String(err)}`));
            failed++;
          }
        }

        console.log(`\n${pc.green(`${installed} installed`)}, ${failed > 0 ? pc.yellow(`${failed} failed`) : "0 failed"}`);
        return;
      }

      // Require source when not using --profile
      if (!source) {
        console.error(pc.red("Missing required argument: source"));
        console.log(pc.dim("Usage: caamp skills install <source> or caamp skills install --profile <name>"));
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
          // Read SKILL.md for the authoritative name
          const discovered = await discoverSkill(localPath);
          if (discovered) {
            skillName = discovered.name;
          }
        } else if (parsed.type === "package") {
          // Check ct-skills catalog for this package/skill name
          if (!catalog.isCatalogAvailable()) {
            console.error(pc.red("@cleocode/ct-skills is not installed. Run: npm install @cleocode/ct-skills"));
            process.exit(1);
          }
          const catalogSkill = catalog.getSkill(parsed.inferredName);
          if (catalogSkill) {
            localPath = catalog.getSkillDir(catalogSkill.name);
            skillName = catalogSkill.name;
            sourceValue = `@cleocode/ct-skills:${catalogSkill.name}`;
            sourceType = "package";
            console.log(`  Found in catalog: ${pc.bold(catalogSkill.name)} v${catalogSkill.version} (${pc.dim(catalogSkill.category)})`);
          } else {
            console.error(pc.red(`Skill not found in catalog: ${parsed.inferredName}`));
            console.log(pc.dim("Available skills: " + catalog.listSkills().join(", ")));
            process.exit(1);
          }
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
          const isGlobal = sourceType === "package" ? true : (opts.global ?? false);
          await recordSkillInstall(
            skillName,
            sourceValue,
            sourceValue,
            sourceType,
            result.linkedAgents,
            result.canonicalPath,
            isGlobal,
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
