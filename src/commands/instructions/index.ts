/**
 * Instructions command group registration
 */

import { Command } from "commander";
import { registerInstructionsInject } from "./inject.js";
import { registerInstructionsCheck } from "./check.js";
import { registerInstructionsUpdate } from "./update.js";

export function registerInstructionsCommands(program: Command): void {
  const instructions = program
    .command("instructions")
    .description("Manage instruction file injections");

  registerInstructionsInject(instructions);
  registerInstructionsCheck(instructions);
  registerInstructionsUpdate(instructions);
}
