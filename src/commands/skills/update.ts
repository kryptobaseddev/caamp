/**
 * skills update command
 */

import { Command } from "commander";
import pc from "picocolors";
import { getTrackedSkills, checkSkillUpdate, recordSkillInstall } from "../../core/skills/lock.js";
import { installSkill } from "../../core/skills/installer.js";
import { parseSource } from "../../core/sources/parser.js";
import { cloneRepo } from "../../core/sources/github.js";
import { cloneGitLabRepo } from "../../core/sources/gitlab.js";
import { getProvider } from "../../core/registry/providers.js";
import type { Provider } from "../../types.js";

export function registerSkillsUpdate(parent: Command): void {
  parent
    .command("update")
    .description("Update all outdated skills")
    .option("-y, --yes", "Skip confirmation")
    .action(async (opts: { yes?: boolean }) => {
      const tracked = await getTrackedSkills();
      const entries = Object.entries(tracked);

      if (entries.length === 0) {
        console.log(pc.dim("No tracked skills to update."));
        return;
      }

      console.log(pc.dim(`Checking ${entries.length} skill(s) for updates...`));

      // Check all skills for updates
      const outdated: Array<{
        name: string;
        currentVersion?: string;
        latestVersion?: string;
      }> = [];

      for (const [name] of entries) {
        const result = await checkSkillUpdate(name);
        if (result.hasUpdate) {
          outdated.push({
            name,
            currentVersion: result.currentVersion,
            latestVersion: result.latestVersion,
          });
        }
      }

      if (outdated.length === 0) {
        console.log(pc.green("\nAll skills are up to date."));
        return;
      }

      console.log(pc.yellow(`\n${outdated.length} skill(s) have updates available:\n`));

      for (const skill of outdated) {
        const current = skill.currentVersion?.slice(0, 12) ?? "?";
        const latest = skill.latestVersion ?? "?";
        console.log(`  ${pc.bold(skill.name)}  ${pc.dim(current)}  ${pc.dim("->")}  ${pc.cyan(latest)}`);
      }

      // Confirm unless --yes
      if (!opts.yes) {
        const readline = await import("node:readline");
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise<string>((resolve) => {
          rl.question(pc.dim("\nProceed with update? [y/N] "), resolve);
        });
        rl.close();

        if (answer.toLowerCase() !== "y" && answer.toLowerCase() !== "yes") {
          console.log(pc.dim("Update cancelled."));
          return;
        }
      }

      console.log();

      // Update each outdated skill
      let successCount = 0;
      let failCount = 0;

      for (const skill of outdated) {
        const entry = tracked[skill.name];
        if (!entry) continue;

        console.log(pc.dim(`Updating ${pc.bold(skill.name)}...`));

        try {
          const parsed = parseSource(entry.source);
          let localPath: string;
          let cleanup: (() => Promise<void>) | undefined;

          if (parsed.type === "github" && parsed.owner && parsed.repo) {
            const result = await cloneRepo(parsed.owner, parsed.repo, parsed.ref, parsed.path);
            localPath = result.localPath;
            cleanup = result.cleanup;
          } else if (parsed.type === "gitlab" && parsed.owner && parsed.repo) {
            const result = await cloneGitLabRepo(parsed.owner, parsed.repo, parsed.ref, parsed.path);
            localPath = result.localPath;
            cleanup = result.cleanup;
          } else {
            console.log(pc.yellow(`  Skipped ${skill.name}: source type "${parsed.type}" does not support auto-update`));
            continue;
          }

          try {
            // Resolve providers from the lock entry's agent list
            const providers = entry.agents
              .map((a) => getProvider(a))
              .filter((p): p is Provider => p !== undefined);

            if (providers.length === 0) {
              console.log(pc.yellow(`  Skipped ${skill.name}: no valid providers found`));
              continue;
            }

            const installResult = await installSkill(
              localPath,
              skill.name,
              providers,
              entry.isGlobal,
              entry.projectDir,
            );

            if (installResult.success) {
              // Record the updated version in the lock file
              await recordSkillInstall(
                skill.name,
                entry.scopedName,
                entry.source,
                entry.sourceType,
                installResult.linkedAgents,
                installResult.canonicalPath,
                entry.isGlobal,
                entry.projectDir,
                skill.latestVersion,
              );

              console.log(pc.green(`  Updated ${pc.bold(skill.name)}`));
              successCount++;
            } else {
              console.log(pc.red(`  Failed to update ${skill.name}: no agents linked`));
              failCount++;
            }

            if (installResult.errors.length > 0) {
              for (const err of installResult.errors) {
                console.log(pc.yellow(`    ${err}`));
              }
            }
          } finally {
            if (cleanup) await cleanup();
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.log(pc.red(`  Failed to update ${skill.name}: ${msg}`));
          failCount++;
        }
      }

      console.log();
      if (successCount > 0) {
        console.log(pc.green(`Updated ${successCount} skill(s).`));
      }
      if (failCount > 0) {
        console.log(pc.red(`Failed to update ${failCount} skill(s).`));
      }
    });
}
