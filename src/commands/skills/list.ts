/**
 * skills list command
 */

import { Command } from "commander";
import pc from "picocolors";
import { discoverSkills, discoverSkillsMulti } from "../../core/skills/discovery.js";
import { listCanonicalSkills } from "../../core/skills/installer.js";
import { getProvider } from "../../core/registry/providers.js";
import { getInstalledProviders } from "../../core/registry/detection.js";
import { join } from "node:path";

export function registerSkillsList(parent: Command): void {
  parent
    .command("list")
    .description("List installed skills")
    .option("-g, --global", "List global skills")
    .option("-a, --agent <name>", "List skills for specific agent")
    .option("--json", "Output as JSON")
    .action(async (opts: { global?: boolean; agent?: string; json?: boolean }) => {
      let dirs: string[] = [];

      if (opts.agent) {
        const provider = getProvider(opts.agent);
        if (!provider) {
          console.error(pc.red(`Provider not found: ${opts.agent}`));
          process.exit(1);
        }
        dirs = opts.global
          ? [provider.pathSkills]
          : [join(process.cwd(), provider.pathProjectSkills)];
      } else if (opts.global) {
        // List from all installed providers' global skill dirs
        const providers = getInstalledProviders();
        dirs = providers.map((p) => p.pathSkills).filter(Boolean);
      } else {
        // List from all installed providers' project skill dirs
        const providers = getInstalledProviders();
        dirs = providers
          .map((p) => join(process.cwd(), p.pathProjectSkills))
          .filter(Boolean);
      }

      const skills = await discoverSkillsMulti(dirs);

      if (opts.json) {
        console.log(JSON.stringify(skills, null, 2));
        return;
      }

      if (skills.length === 0) {
        console.log(pc.dim("No skills found."));
        return;
      }

      console.log(pc.bold(`\n${skills.length} skill(s) found:\n`));

      for (const skill of skills) {
        console.log(`  ${pc.bold(skill.name.padEnd(30))} ${pc.dim(skill.metadata.description ?? "")}`);
      }

      console.log();
    });
}
