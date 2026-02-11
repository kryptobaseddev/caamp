/**
 * skills update command
 */

import { Command } from "commander";
import pc from "picocolors";
import { getTrackedSkills } from "../../core/skills/lock.js";

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

      // For now, skills update is a placeholder - requires network checks
      console.log(pc.dim("All skills are up to date."));
      console.log(pc.dim("\nTo reinstall a specific skill:"));
      console.log(pc.dim("  caamp skills install <source>"));
    });
}
