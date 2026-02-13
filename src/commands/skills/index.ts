/**
 * Skills command group registration
 */

import type { Command } from "commander";
import { registerSkillsInstall } from "./install.js";
import { registerSkillsRemove } from "./remove.js";
import { registerSkillsList } from "./list.js";
import { registerSkillsFind } from "./find.js";
import { registerSkillsCheck } from "./check.js";
import { registerSkillsUpdate } from "./update.js";
import { registerSkillsInit } from "./init.js";
import { registerSkillsAudit } from "./audit.js";
import { registerSkillsValidate } from "./validate.js";

export function registerSkillsCommands(program: Command): void {
  const skills = program
    .command("skills")
    .description("Manage AI agent skills");

  registerSkillsInstall(skills);
  registerSkillsRemove(skills);
  registerSkillsList(skills);
  registerSkillsFind(skills);
  registerSkillsCheck(skills);
  registerSkillsUpdate(skills);
  registerSkillsInit(skills);
  registerSkillsAudit(skills);
  registerSkillsValidate(skills);
}
