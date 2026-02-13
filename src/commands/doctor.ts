/**
 * doctor command - diagnose configuration issues and health
 */

import { Command } from "commander";
import pc from "picocolors";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, lstatSync, readlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CANONICAL_SKILLS_DIR } from "../core/paths/agents.js";
import { getAllProviders, getProviderCount } from "../core/registry/providers.js";
import { detectAllProviders } from "../core/registry/detection.js";
import { readLockFile } from "../core/mcp/lock.js";
import { readConfig } from "../core/formats/index.js";
import { getCaampVersion } from "../core/version.js";
import type { Provider } from "../types.js";

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

  checks.push({ label: `CAAMP v${getCaampVersion()}`, status: "pass" });
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

  const canonicalDir = CANONICAL_SKILLS_DIR;

  if (!existsSync(canonicalDir)) {
    checks.push({ label: "0 canonical skills", status: "pass" });
    checks.push({ label: "No broken symlinks", status: "pass" });
    return { name: "Skills", checks };
  }

  let canonicalCount = 0;
  let canonicalNames: string[] = [];
  try {
    canonicalNames = readdirSync(canonicalDir).filter((name) => {
      const full = join(canonicalDir, name);
      try {
        const stat = lstatSync(full);
        return stat.isDirectory() || stat.isSymbolicLink();
      } catch {
        return false;
      }
    });
    canonicalCount = canonicalNames.length;
    checks.push({ label: `${canonicalCount} canonical skills`, status: "pass" });
  } catch {
    checks.push({ label: "Cannot read skills directory", status: "warn" });
    return { name: "Skills", checks };
  }

  // Check symlinks in installed provider skill directories
  const broken: string[] = [];
  const stale: string[] = [];
  const results = detectAllProviders();
  const installed = results.filter((r) => r.installed);

  for (const r of installed) {
    const provider = r.provider;
    const skillDir = provider.pathSkills;
    if (!existsSync(skillDir)) continue;

    try {
      const entries = readdirSync(skillDir);
      for (const entry of entries) {
        const fullPath = join(skillDir, entry);
        try {
          const stat = lstatSync(fullPath);
          if (!stat.isSymbolicLink()) continue;

          if (!existsSync(fullPath)) {
            broken.push(`${provider.id}/${entry}`);
          } else {
            // Check if symlink points to canonical location
            const target = readlinkSync(fullPath);
            const isCanonical =
              target.includes("/.agents/skills/") ||
              target.includes("\\.agents\\skills\\");
            if (!isCanonical) {
              stale.push(`${provider.id}/${entry}`);
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
      label: `${broken.length} broken symlink${broken.length !== 1 ? "s" : ""}`,
      status: "warn",
      detail: broken.join(", "),
    });
  }

  if (stale.length === 0) {
    checks.push({ label: "No stale symlinks", status: "pass" });
  } else {
    checks.push({
      label: `${stale.length} stale symlink${stale.length !== 1 ? "s" : ""} (not pointing to ~/.agents/skills/)`,
      status: "warn",
      detail: stale.join(", "),
    });
  }

  return { name: "Skills", checks };
}

async function checkLockFile(): Promise<SectionResult> {
  const checks: CheckResult[] = [];

  try {
    const lock = await readLockFile();
    checks.push({ label: "Lock file valid", status: "pass" });

    const lockSkillNames = Object.keys(lock.skills);
    checks.push({ label: `${lockSkillNames.length} skill entries`, status: "pass" });

    // Check for orphaned skill entries (canonical path no longer exists)
    const orphaned: string[] = [];
    for (const [name, entry] of Object.entries(lock.skills)) {
      if (entry.canonicalPath && !existsSync(entry.canonicalPath)) {
        orphaned.push(name);
      }
    }

    if (orphaned.length === 0) {
      checks.push({ label: "0 orphaned entries", status: "pass" });
    } else {
      checks.push({
        label: `${orphaned.length} orphaned skill${orphaned.length !== 1 ? "s" : ""} (in lock, missing from disk)`,
        status: "warn",
        detail: orphaned.join(", "),
      });
    }

    // Check for untracked skills (on disk but not in lock)
    const canonicalDir = CANONICAL_SKILLS_DIR;
    if (existsSync(canonicalDir)) {
      const onDisk = readdirSync(canonicalDir).filter((name) => {
        try {
          const stat = lstatSync(join(canonicalDir, name));
          return stat.isDirectory() || stat.isSymbolicLink();
        } catch {
          return false;
        }
      });
      const untracked = onDisk.filter((name) => !lock.skills[name]);

      if (untracked.length === 0) {
        checks.push({ label: "0 untracked skills", status: "pass" });
      } else {
        checks.push({
          label: `${untracked.length} untracked skill${untracked.length !== 1 ? "s" : ""} (on disk, not in lock)`,
          status: "warn",
          detail: untracked.join(", "),
        });
      }
    }

    // Check lock agent-list vs actual symlinks
    const results = detectAllProviders();
    const installed = results.filter((r) => r.installed);
    const mismatches: string[] = [];

    for (const [name, entry] of Object.entries(lock.skills)) {
      if (!entry.agents || entry.agents.length === 0) continue;

      for (const agentId of entry.agents) {
        const provider = installed.find((r) => r.provider.id === agentId);
        if (!provider) continue;

        const linkPath = join(provider.provider.pathSkills, name);
        if (!existsSync(linkPath)) {
          mismatches.push(`${name} missing from ${agentId}`);
        }
      }
    }

    if (mismatches.length === 0) {
      checks.push({ label: "Lock agent-lists match symlinks", status: "pass" });
    } else {
      checks.push({
        label: `${mismatches.length} agent-list mismatch${mismatches.length !== 1 ? "es" : ""}`,
        status: "warn",
        detail: mismatches.slice(0, 5).join(", ") + (mismatches.length > 5 ? ` (+${mismatches.length - 5} more)` : ""),
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
          version: getCaampVersion(),
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
