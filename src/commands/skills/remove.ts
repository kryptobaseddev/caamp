/**
 * skills remove command
 */

import { Command } from "commander";
import pc from "picocolors";
import { removeSkill, listCanonicalSkills } from "../../core/skills/installer.js";
import { removeSkillFromLock } from "../../core/skills/lock.js";
import { getInstalledProviders } from "../../core/registry/detection.js";

export function registerSkillsRemove(parent: Command): void {
  parent
    .command("remove")
    .description("Remove installed skill(s)")
    .argument("[name]", "Skill name to remove")
    .option("-g, --global", "Remove from global scope")
    .option("-y, --yes", "Skip confirmation")
    .action(async (name: string | undefined, opts: { global?: boolean; yes?: boolean }) => {
      const providers = getInstalledProviders();

      if (name) {
        const result = await removeSkill(name, providers, opts.global ?? false);

        if (result.removed.length > 0) {
          console.log(pc.green(`✓ Removed ${pc.bold(name)} from: ${result.removed.join(", ")}`));
          await removeSkillFromLock(name);
        } else {
          console.log(pc.yellow(`Skill ${name} not found in any provider.`));
        }

        if (result.errors.length > 0) {
          for (const err of result.errors) {
            console.log(pc.red(`  ${err}`));
          }
        }
      } else {
        // Interactive mode - list and select
        const skills = await listCanonicalSkills();
        if (skills.length === 0) {
          console.log(pc.dim("No skills installed."));
          return;
        }

        console.log(pc.bold("Installed skills:"));
        for (const s of skills) {
          console.log(`  ${s}`);
        }
        console.log(pc.dim("\nUse: caamp skills remove <name>"));
      }
    });
}
