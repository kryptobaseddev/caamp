/**
 * skills audit command - security scanning
 */

import { Command } from "commander";
import pc from "picocolors";
import { scanFile, scanDirectory, toSarif } from "../../core/skills/audit/scanner.js";
import { existsSync, statSync } from "node:fs";

export function registerSkillsAudit(parent: Command): void {
  parent
    .command("audit")
    .description("Security scan skill files (46+ rules, SARIF output)")
    .argument("[path]", "Path to SKILL.md or directory", ".")
    .option("--sarif", "Output in SARIF format")
    .option("--json", "Output as JSON")
    .action(async (path: string, opts: { sarif?: boolean; json?: boolean }) => {
      if (!existsSync(path)) {
        console.error(pc.red(`Path not found: ${path}`));
        process.exit(1);
      }

      const stat = statSync(path);
      let results;

      if (stat.isFile()) {
        results = [await scanFile(path)];
      } else {
        results = await scanDirectory(path);
      }

      if (results.length === 0) {
        console.log(pc.dim("No SKILL.md files found to scan."));
        return;
      }

      if (opts.sarif) {
        console.log(JSON.stringify(toSarif(results), null, 2));
        return;
      }

      if (opts.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      // Human-readable output
      let totalFindings = 0;
      let allPassed = true;

      for (const result of results) {
        const icon = result.passed ? pc.green("✓") : pc.red("✗");
        console.log(`\n${icon} ${pc.bold(result.file)} (score: ${result.score}/100)`);

        if (result.findings.length === 0) {
          console.log(pc.dim("  No issues found."));
          continue;
        }

        totalFindings += result.findings.length;
        if (!result.passed) allPassed = false;

        for (const f of result.findings) {
          const sev = f.rule.severity === "critical" ? pc.red(f.rule.severity)
            : f.rule.severity === "high" ? pc.red(f.rule.severity)
              : f.rule.severity === "medium" ? pc.yellow(f.rule.severity)
                : pc.dim(f.rule.severity);

          console.log(`  ${sev.padEnd(20)} ${f.rule.id} ${f.rule.name}`);
          console.log(`  ${pc.dim(`L${f.line}: ${f.context.slice(0, 80)}`)}`);
        }
      }

      console.log(pc.bold(`\n${results.length} file(s) scanned, ${totalFindings} finding(s)`));

      if (!allPassed) {
        process.exit(1);
      }
    });
}
