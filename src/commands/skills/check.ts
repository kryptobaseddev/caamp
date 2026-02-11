/**
 * skills check command - check for updates
 */

import { Command } from "commander";
import pc from "picocolors";
import { getTrackedSkills, checkSkillUpdate } from "../../core/skills/lock.js";

export function registerSkillsCheck(parent: Command): void {
  parent
    .command("check")
    .description("Check for available skill updates")
    .option("--json", "Output as JSON")
    .action(async (opts: { json?: boolean }) => {
      const tracked = await getTrackedSkills();
      const entries = Object.entries(tracked);

      if (entries.length === 0) {
        console.log(pc.dim("No tracked skills."));
        return;
      }

      const results = [];
      for (const [name, entry] of entries) {
        const update = await checkSkillUpdate(name);
        results.push({ name, entry, ...update });
      }

      if (opts.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      console.log(pc.bold(`\n${entries.length} tracked skill(s):\n`));

      for (const r of results) {
        const status = r.hasUpdate
          ? pc.yellow("update available")
          : pc.green("up to date");

        console.log(`  ${pc.bold(r.name.padEnd(30))} ${status}`);
        console.log(`  ${pc.dim(`source: ${r.entry.source}`)}`);
        console.log(`  ${pc.dim(`agents: ${r.entry.agents.join(", ")}`)}`);
        console.log();
      }
    });
}
