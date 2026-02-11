/**
 * instructions update command
 */

import { Command } from "commander";
import pc from "picocolors";
import { injectAll, checkAllInjections } from "../../core/instructions/injector.js";
import { generateInjectionContent } from "../../core/instructions/templates.js";
import { getInstalledProviders } from "../../core/registry/detection.js";
import type { Provider } from "../../types.js";

export function registerInstructionsUpdate(parent: Command): void {
  parent
    .command("update")
    .description("Update all instruction file injections")
    .option("-g, --global", "Update global instruction files")
    .option("-y, --yes", "Skip confirmation")
    .action(async (opts: { global?: boolean; yes?: boolean }) => {
      const providers = getInstalledProviders();
      const scope = opts.global ? "global" as const : "project" as const;
      const content = generateInjectionContent();

      // Check current state
      const checks = await checkAllInjections(providers, process.cwd(), scope, content);
      const needsUpdate = checks.filter((c) => c.status !== "current");

      if (needsUpdate.length === 0) {
        console.log(pc.green("All instruction files are up to date."));
        return;
      }

      console.log(pc.bold(`${needsUpdate.length} file(s) need updating:\n`));
      for (const c of needsUpdate) {
        console.log(`  ${c.file} (${c.status})`);
      }

      // Filter providers to only those needing updates
      const providerIds = new Set(needsUpdate.map((c) => c.provider));
      const toUpdate = providers.filter((p) => providerIds.has(p.id));

      const results = await injectAll(toUpdate, process.cwd(), scope, content);

      console.log();
      for (const [file, action] of results) {
        console.log(`  ${pc.green("✓")} ${file} (${action})`);
      }

      console.log(pc.bold(`\n${results.size} file(s) updated.`));
    });
}
