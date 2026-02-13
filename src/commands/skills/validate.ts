/**
 * skills validate command
 */

import type { Command } from "commander";
import pc from "picocolors";
import { validateSkill } from "../../core/skills/validator.js";

export function registerSkillsValidate(parent: Command): void {
  parent
    .command("validate")
    .description("Validate SKILL.md format")
    .argument("[path]", "Path to SKILL.md", "SKILL.md")
    .option("--json", "Output as JSON")
    .action(async (path: string, opts: { json?: boolean }) => {
      const result = await validateSkill(path);

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      if (result.valid) {
        console.log(pc.green(`✓ ${path} is valid`));
      } else {
        console.log(pc.red(`✗ ${path} has validation errors`));
      }

      for (const issue of result.issues) {
        const icon = issue.level === "error" ? pc.red("✗") : pc.yellow("!");
        console.log(`  ${icon} [${issue.field}] ${issue.message}`);
      }

      if (!result.valid) {
        process.exit(1);
      }
    });
}
