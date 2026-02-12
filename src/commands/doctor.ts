/**
 * doctor command - diagnose configuration issues and health
 */

import { Command } from "commander";
import pc from "picocolors";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, lstatSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getAllProviders, getProviderCount } from "../core/registry/providers.js";
import { detectAllProviders } from "../core/registry/detection.js";
import { readLockFile } from "../core/mcp/lock.js";
import { readConfig } from "../core/formats/index.js";
import type { Provider } from "../types.js";

const CAAMP_VERSION = "0.2.0";

interface CheckResult {
  label: string;
  status: "pass" | "warn" | "fail";
  detail?: string;
}

interface SectionResult {
  name: string;
  checks: CheckResult[];
}

function getNodeVersion(): string {
  return process.version;
}

function getNpmVersion(): string | null {
  try {
    return execFileSync("npm", ["--version"], { stdio: "pipe", encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
}

function checkEnvironment(): SectionResult {
  const checks: CheckResult[] = [];

  checks.push({ label: `Node.js ${getNodeVersion()}`, status: "pass" });

  const npmVersion = getNpmVersion();
  if (npmVersion) {
    checks.push({ label: `npm ${npmVersion}`, status: "pass" });
  } else {
    checks.push({ label: "npm not found", status: "warn" });
  }

  checks.push({ label: `CAAMP v${CAAMP_VERSION}`, status: "pass" });
  checks.push({ label: `${process.platform} ${process.arch}`, status: "pass" });

  return { name: "Environment", checks };
}

function checkRegistry(): SectionResult {
  const checks: CheckResult[] = [];

  try {
    const providers = getAllProviders();
    const count = getProviderCount();
    checks.push({ label: `${count} providers loaded`, status: "pass" });

    const malformed: string[] = [];
    for (const p of providers) {
      if (!p.id || !p.toolName || !p.configKey || !p.configFormat) {
        malformed.push(p.id || "(unknown)");
      }
    }

    if (malformed.length === 0) {
      checks.push({ label: "All entries valid", status: "pass" });
    } else {
      checks.push({
        label: `${malformed.length} malformed entries`,
        status: "fail",
        detail: malformed.join(", "),
      });
    }
  } catch (err) {
    checks.push({
      label: "Failed to load registry",
      status: "fail",
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  return { name: "Registry", checks };
}

function checkInstalledProviders(): SectionResult {
  const checks: CheckResult[] = [];

  try {
    const results = detectAllProviders();
    const installed = results.filter((r) => r.installed);

    checks.push({ label: `${installed.length} found`, status: "pass" });

    for (const r of installed) {
      const methods = r.methods.join(", ");
      checks.push({ label: `${r.provider.toolName} (${methods})`, status: "pass" });
    }
  } catch (err) {
    checks.push({
      label: "Detection failed",
      status: "fail",
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  return { name: "Installed Providers", checks };
}

function checkSkillSymlinks(): SectionResult {
  const checks: CheckResult[] = [];

  const canonicalDir = join(homedir(), ".agents", "skills");

  if (!existsSync(canonicalDir)) {
    checks.push({ label: "0 canonical skills", status: "pass" });
    checks.push({ label: "No broken symlinks", status: "pass" });
    return { name: "Skills", checks };
  }

  let canonicalCount = 0;
  try {
    const entries = readdirSync(canonicalDir);
    canonicalCount = entries.length;
    checks.push({ label: `${canonicalCount} canonical skills`, status: "pass" });
  } catch {
    checks.push({ label: "Cannot read skills directory", status: "warn" });
    return { name: "Skills", checks };
  }

  // Check symlinks in provider skill directories
  const broken: string[] = [];
  const providers = getAllProviders();
  for (const provider of providers) {
    const skillDir = provider.pathSkills;
    if (!existsSync(skillDir)) continue;

    try {
      const entries = readdirSync(skillDir);
      for (const entry of entries) {
        const fullPath = join(skillDir, entry);
        try {
          const stat = lstatSync(fullPath);
          if (stat.isSymbolicLink()) {
            // Check if target exists
            if (!existsSync(fullPath)) {
              broken.push(`${provider.id}/${entry}`);
            }
          }
        } catch {
          // skip unreadable entries
        }
      }
    } catch {
      // skip unreadable dirs
    }
  }

  if (broken.length === 0) {
    checks.push({ label: "No broken symlinks", status: "pass" });
  } else {
    checks.push({
      label: `${broken.length} broken symlinks`,
      status: "warn",
      detail: broken.join(", "),
    });
  }

  return { name: "Skills", checks };
}

async function checkLockFile(): Promise<SectionResult> {
  const checks: CheckResult[] = [];

  try {
    const lock = await readLockFile();
    checks.push({ label: "Lock file valid", status: "pass" });

    // Check for orphaned skill entries (canonical path no longer exists)
    let orphaned = 0;
    for (const [name, entry] of Object.entries(lock.skills)) {
      if (entry.canonicalPath && !existsSync(entry.canonicalPath)) {
        orphaned++;
      }
    }

    // Check for orphaned MCP entries
    // MCP servers don't have canonical paths to verify on disk,
    // so we only count skill orphans
    if (orphaned === 0) {
      checks.push({ label: `0 orphaned entries`, status: "pass" });
    } else {
      checks.push({
        label: `${orphaned} orphaned skill entries`,
        status: "warn",
        detail: "Skills tracked in lock file but missing from disk",
      });
    }
  } catch (err) {
    checks.push({
      label: "Failed to read lock file",
      status: "fail",
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  return { name: "Lock File", checks };
}

async function checkConfigFiles(): Promise<SectionResult> {
  const checks: CheckResult[] = [];

  const results = detectAllProviders();
  const installed = results.filter((r) => r.installed);

  for (const r of installed) {
    const provider = r.provider;
    const configPath = provider.configPathGlobal;

    if (!existsSync(configPath)) {
      checks.push({
        label: `${provider.id}: no config file found`,
        status: "warn",
        detail: configPath,
      });
      continue;
    }

    try {
      await readConfig(configPath, provider.configFormat);
      const relPath = configPath.replace(homedir(), "~");
      checks.push({
        label: `${provider.id}: ${relPath} readable`,
        status: "pass",
      });
    } catch (err) {
      checks.push({
        label: `${provider.id}: config parse error`,
        status: "fail",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (installed.length === 0) {
    checks.push({ label: "No installed providers to check", status: "pass" });
  }

  return { name: "Config Files", checks };
}

function formatSection(section: SectionResult): string {
  const lines: string[] = [];
  lines.push(`  ${pc.bold(section.name)}`);

  for (const check of section.checks) {
    const icon =
      check.status === "pass"
        ? pc.green("✓")
        : check.status === "warn"
          ? pc.yellow("⚠")
          : pc.red("✗");

    lines.push(`    ${icon} ${check.label}`);

    if (check.detail) {
      lines.push(`      ${pc.dim(check.detail)}`);
    }
  }

  return lines.join("\n");
}

interface JsonOutput {
  version: string;
  sections: Array<{
    name: string;
    checks: CheckResult[];
  }>;
  summary: {
    passed: number;
    warnings: number;
    errors: number;
  };
}

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Diagnose configuration issues and health")
    .option("--json", "Output as JSON")
    .action(async (opts: { json?: boolean }) => {
      const sections: SectionResult[] = [];

      sections.push(checkEnvironment());
      sections.push(checkRegistry());
      sections.push(checkInstalledProviders());
      sections.push(checkSkillSymlinks());
      sections.push(await checkLockFile());
      sections.push(await checkConfigFiles());

      // Tally results
      let passed = 0;
      let warnings = 0;
      let errors = 0;

      for (const section of sections) {
        for (const check of section.checks) {
          if (check.status === "pass") passed++;
          else if (check.status === "warn") warnings++;
          else errors++;
        }
      }

      if (opts.json) {
        const output: JsonOutput = {
          version: CAAMP_VERSION,
          sections: sections.map((s) => ({
            name: s.name,
            checks: s.checks,
          })),
          summary: { passed, warnings, errors },
        };
        console.log(JSON.stringify(output, null, 2));
        return;
      }

      console.log(pc.bold("\ncaamp doctor\n"));

      for (const section of sections) {
        console.log(formatSection(section));
        console.log();
      }

      // Summary line
      const parts: string[] = [];
      parts.push(pc.green(`${passed} checks passed`));
      if (warnings > 0) parts.push(pc.yellow(`${warnings} warning${warnings !== 1 ? "s" : ""}`));
      if (errors > 0) parts.push(pc.red(`${errors} error${errors !== 1 ? "s" : ""}`));

      console.log(`  ${pc.bold("Summary")}: ${parts.join(", ")}`);
      console.log();

      if (errors > 0) {
        process.exit(1);
      }
    });
}
