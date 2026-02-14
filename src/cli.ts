#!/usr/bin/env node

/**
 * CAAMP CLI - Central AI Agent Managed Packages
 */

import { Command } from "commander";
import { registerProvidersCommand } from "./commands/providers.js";
import { registerSkillsCommands } from "./commands/skills/index.js";
import { registerMcpCommands } from "./commands/mcp/index.js";
import { registerInstructionsCommands } from "./commands/instructions/index.js";
import { registerConfigCommand } from "./commands/config.js";
import { registerDoctorCommand } from "./commands/doctor.js";
import { registerAdvancedCommands } from "./commands/advanced/index.js";
import { isVerbose, setVerbose, setQuiet } from "./core/logger.js";
import { getCaampVersion } from "./core/version.js";

const program = new Command();

program
  .name("caamp")
  .description("Central AI Agent Managed Packages - unified provider registry and package manager")
  .version(getCaampVersion())
  .option("-v, --verbose", "Show debug output")
  .option("-q, --quiet", "Suppress non-error output");

program.hook("preAction", (thisCommand) => {
  const opts = thisCommand.optsWithGlobals();
  if (opts.verbose) setVerbose(true);
  if (opts.quiet) setQuiet(true);
});

// Register command groups
registerProvidersCommand(program);
registerSkillsCommands(program);
registerMcpCommands(program);
registerInstructionsCommands(program);
registerConfigCommand(program);
registerDoctorCommand(program);
registerAdvancedCommands(program);

function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(String(error));
}

function handleFatal(error: unknown, source: "uncaughtException" | "unhandledRejection" | "cli"): void {
  const normalized = toError(error);
  console.error(`Fatal error (${source}): ${normalized.message}`);
  if (isVerbose() && normalized.stack) {
    console.error(normalized.stack);
  }
}

process.on("uncaughtException", (error) => {
  handleFatal(error, "uncaughtException");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  handleFatal(reason, "unhandledRejection");
  process.exit(1);
});

async function main(): Promise<void> {
  await program.parseAsync(process.argv);
}

main().catch((error) => {
  handleFatal(error, "cli");
  process.exit(1);
});
