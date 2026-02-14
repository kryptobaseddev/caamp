import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanDirectory, scanFile, toSarif } from "../../src/core/skills/audit/scanner.js";
import type { AuditResult } from "../../src/types.js";

const tempDirs: string[] = [];

async function createTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("skills audit scanner", () => {
  it("returns clean result for missing files", async () => {
    const result = await scanFile("/tmp/not-real-skill-file.md");
    expect(result).toEqual({
      file: "/tmp/not-real-skill-file.md",
      findings: [],
      score: 100,
      passed: true,
    });
  });

  it("detects matches, computes penalties, and fails on high severity", async () => {
    const root = await createTempDir("caamp-audit-");
    const skillPath = join(root, "SKILL.md");
    await writeFile(skillPath, "run this: sudo rm -rf /\n", "utf-8");

    const result = await scanFile(skillPath, [
      {
        id: "RULE_HIGH",
        name: "High danger",
        description: "High severity match",
        severity: "high",
        category: "security",
        pattern: /sudo rm -rf/,
      },
      {
        id: "RULE_LOW",
        name: "Low danger",
        description: "Low severity match",
        severity: "low",
        category: "style",
        pattern: /run this/,
      },
    ]);

    expect(result.findings).toHaveLength(2);
    expect(result.findings[0]?.line).toBe(1);
    expect(result.findings[0]?.column).toBe(11);
    expect(result.score).toBe(82);
    expect(result.passed).toBe(false);
  });

  it("scans SKILL.md files in directories and symlink entries", async () => {
    const root = await createTempDir("caamp-audit-");
    const one = join(root, "one");
    const two = join(root, "two");
    const linked = join(root, "linked");

    await mkdir(one, { recursive: true });
    await mkdir(two, { recursive: true });
    await writeFile(join(one, "SKILL.md"), "# safe skill\n", "utf-8");
    await symlink(one, linked, "dir");

    const results = await scanDirectory(root);

    expect(results).toHaveLength(2);
    expect(results.every((entry) => entry.file.endsWith("/SKILL.md"))).toBe(true);
    expect(results.some((entry) => entry.file.includes("/one/SKILL.md"))).toBe(true);
    expect(results.some((entry) => entry.file.includes("/linked/SKILL.md"))).toBe(true);
  });

  it("converts audit findings into SARIF", () => {
    const results: AuditResult[] = [
      {
        file: "/tmp/demo/SKILL.md",
        score: 85,
        passed: false,
        findings: [
          {
            line: 4,
            column: 3,
            match: "curl http://example.com",
            context: "curl http://example.com",
            rule: {
              id: "NO_CURL",
              name: "Disallow curl",
              description: "Avoid unverified remote execution",
              severity: "high",
              category: "security",
              pattern: /curl/,
            },
          },
        ],
      },
    ];

    const sarif = toSarif(results) as {
      version: string;
      runs: Array<{
        tool: { driver: { name: string } };
        results: Array<{ ruleId: string; level: string; locations: Array<{ physicalLocation: { region: { startLine: number } } }> }>;
      }>;
    };

    expect(sarif.version).toBe("2.1.0");
    expect(sarif.runs[0]?.tool.driver.name).toBe("caamp-audit");
    expect(sarif.runs[0]?.results[0]?.ruleId).toBe("NO_CURL");
    expect(sarif.runs[0]?.results[0]?.level).toBe("error");
    expect(sarif.runs[0]?.results[0]?.locations[0]?.physicalLocation.region.startLine).toBe(4);
  });
});
