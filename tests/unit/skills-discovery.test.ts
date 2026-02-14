import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  discoverSkill,
  discoverSkills,
  discoverSkillsMulti,
  parseSkillFile,
} from "../../src/core/skills/discovery.js";

const tempDirs: string[] = [];

async function createTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function skillDoc(name: string, description: string, extra = ""): string {
  return `---\nname: ${name}\ndescription: ${description}${extra}\n---\n\n# ${name}\n`;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("skills discovery", () => {
  it("parses valid SKILL.md frontmatter", async () => {
    const root = await createTempDir("caamp-discovery-");
    const skillPath = join(root, "SKILL.md");
    await writeFile(
      skillPath,
      skillDoc("docs-helper", "Improves docs workflows", "\nallowed-tools: read write\nversion: 1.2.0"),
      "utf-8",
    );

    const parsed = await parseSkillFile(skillPath);

    expect(parsed).toEqual({
      name: "docs-helper",
      description: "Improves docs workflows",
      license: undefined,
      compatibility: undefined,
      metadata: undefined,
      allowedTools: ["read", "write"],
      version: "1.2.0",
    });
  });

  it("returns null for invalid skill metadata", async () => {
    const root = await createTempDir("caamp-discovery-");
    const skillPath = join(root, "SKILL.md");
    await writeFile(skillPath, "---\nname: missing-description\n---\n", "utf-8");

    await expect(parseSkillFile(skillPath)).resolves.toBeNull();
    await expect(parseSkillFile(join(root, "MISSING.md"))).resolves.toBeNull();
  });

  it("discovers one skill directory and ignores missing SKILL.md", async () => {
    const root = await createTempDir("caamp-discovery-");
    const withSkill = join(root, "good-skill");
    const withoutSkill = join(root, "empty-skill");

    await mkdir(withSkill, { recursive: true });
    await mkdir(withoutSkill, { recursive: true });
    await writeFile(join(withSkill, "SKILL.md"), skillDoc("good-skill", "Valid skill"), "utf-8");

    const discovered = await discoverSkill(withSkill);
    const missing = await discoverSkill(withoutSkill);

    expect(discovered?.name).toBe("good-skill");
    expect(discovered?.scopedName).toBe("good-skill");
    expect(discovered?.path).toBe(withSkill);
    expect(missing).toBeNull();
  });

  it("scans directories and symlinks for skills", async () => {
    const root = await createTempDir("caamp-discovery-");
    const alpha = join(root, "alpha");
    const beta = join(root, "beta");
    const linked = join(root, "linked");

    await mkdir(alpha, { recursive: true });
    await mkdir(beta, { recursive: true });
    await writeFile(join(alpha, "SKILL.md"), skillDoc("alpha", "Alpha skill"), "utf-8");
    await writeFile(join(beta, "SKILL.md"), skillDoc("beta", "Beta skill"), "utf-8");
    await symlink(alpha, linked, "dir");

    const discovered = await discoverSkills(root);
    const names = discovered.map((skill) => skill.name).sort();

    expect(names).toEqual(["alpha", "alpha", "beta"]);
  });

  it("deduplicates skill names across multiple roots", async () => {
    const firstRoot = await createTempDir("caamp-discovery-a-");
    const secondRoot = await createTempDir("caamp-discovery-b-");

    const firstAlpha = join(firstRoot, "alpha");
    const secondAlpha = join(secondRoot, "alpha");
    const secondGamma = join(secondRoot, "gamma");

    await mkdir(firstAlpha, { recursive: true });
    await mkdir(secondAlpha, { recursive: true });
    await mkdir(secondGamma, { recursive: true });

    await writeFile(join(firstAlpha, "SKILL.md"), skillDoc("alpha", "First alpha"), "utf-8");
    await writeFile(join(secondAlpha, "SKILL.md"), skillDoc("alpha", "Second alpha"), "utf-8");
    await writeFile(join(secondGamma, "SKILL.md"), skillDoc("gamma", "Gamma"), "utf-8");

    const discovered = await discoverSkillsMulti([firstRoot, secondRoot]);

    expect(discovered.map((skill) => skill.name)).toEqual(["alpha", "gamma"]);
    expect(discovered[0]?.metadata.description).toBe("First alpha");
  });
});
