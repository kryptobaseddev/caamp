/**
 * skills init command - scaffold a new skill
 */

import type { Command } from "commander";
import pc from "picocolors";
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

export function registerSkillsInit(parent: Command): void {
  parent
    .command("init")
    .description("Create a new SKILL.md template")
    .argument("[name]", "Skill name")
    .option("-d, --dir <path>", "Output directory", ".")
    .action(async (name: string | undefined, opts: { dir: string }) => {
      const skillName = name ?? "my-skill";
      const skillDir = join(opts.dir, skillName);

      if (existsSync(skillDir)) {
        console.error(pc.red(`Directory already exists: ${skillDir}`));
        process.exit(1);
      }

      await mkdir(skillDir, { recursive: true });

      const template = `---
name: ${skillName}
description: Describe what this skill does and when to use it
license: MIT
metadata:
  author: your-name
  version: "1.0"
---

# ${skillName}

## When to use this skill

Describe the conditions under which an AI agent should activate this skill.

## Instructions

Provide detailed instructions for the AI agent here.

## Examples

Show example inputs and expected outputs.
`;

      await writeFile(join(skillDir, "SKILL.md"), template, "utf-8");

      console.log(pc.green(`✓ Created skill template: ${skillDir}/SKILL.md`));
      console.log(pc.dim("\nNext steps:"));
      console.log(pc.dim("  1. Edit SKILL.md with your instructions"));
      console.log(pc.dim(`  2. Validate: caamp skills validate ${join(skillDir, "SKILL.md")}`));
      console.log(pc.dim(`  3. Install: caamp skills install ${skillDir}`));
    });
}
