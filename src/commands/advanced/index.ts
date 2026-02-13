/**
 * Advanced command group registration.
 */

import type { Command } from "commander";
import { registerAdvancedProviders } from "./providers.js";
import { registerAdvancedBatch } from "./batch.js";
import { registerAdvancedConflicts } from "./conflicts.js";
import { registerAdvancedApply } from "./apply.js";
import { registerAdvancedInstructions } from "./instructions.js";
import { registerAdvancedConfigure } from "./configure.js";

export function registerAdvancedCommands(program: Command): void {
  const advanced = program
    .command("advanced")
    .description("LAFS-compliant wrappers for advanced orchestration APIs");

  registerAdvancedProviders(advanced);
  registerAdvancedBatch(advanced);
  registerAdvancedConflicts(advanced);
  registerAdvancedApply(advanced);
  registerAdvancedInstructions(advanced);
  registerAdvancedConfigure(advanced);
}
