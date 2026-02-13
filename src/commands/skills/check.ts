/**
 * skills check command - check for updates
 */

import type { Command } from "commander";
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

      console.log(pc.dim(`Checking ${entries.length} skill(s) for updates...\n`));

      const results = [];
      for (const [name, entry] of entries) {
        const update = await checkSkillUpdate(name);
        results.push({ name, entry, ...update });
      }

      if (opts.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      let updatesAvailable = 0;

      for (const r of results) {
        let statusLabel: string;
        if (r.status === "update-available") {
          statusLabel = pc.yellow("update available");
          updatesAvailable++;
        } else if (r.status === "up-to-date") {
          statusLabel = pc.green("up to date");
        } else {
          statusLabel = pc.dim("unknown");
        }

        console.log(`  ${pc.bold(r.name.padEnd(30))} ${statusLabel}`);

        if (r.currentVersion || r.latestVersion) {
          const current = r.currentVersion ? r.currentVersion.slice(0, 12) : "?";
          const latest = r.latestVersion ?? "?";
          if (r.hasUpdate) {
            console.log(`  ${pc.dim("current:")} ${current}  ${pc.dim("->")}  ${pc.cyan(latest)}`);
          } else {
            console.log(`  ${pc.dim("version:")} ${current}`);
          }
        }

        console.log(`  ${pc.dim(`source: ${r.entry.source}`)}`);
        console.log(`  ${pc.dim(`agents: ${r.entry.agents.join(", ")}`)}`);
        console.log();
      }

      if (updatesAvailable > 0) {
        console.log(pc.yellow(`${updatesAvailable} update(s) available.`));
        console.log(pc.dim("Run `caamp skills update` to update all."));
      } else {
        console.log(pc.green("All skills are up to date."));
      }
    });
}
