/**
 * MCP command group registration
 */

import type { Command } from "commander";
import { registerMcpCleoCommands, registerMcpCleoCompatibilityCommands } from "./cleo.js";
import { registerMcpDetect } from "./detect.js";
import { registerMcpInstall } from "./install.js";
import { registerMcpList } from "./list.js";
import { registerMcpRemove } from "./remove.js";

export function registerMcpCommands(program: Command): void {
  const mcp = program
    .command("mcp")
    .description("Manage MCP server configurations");

  registerMcpInstall(mcp);
  registerMcpRemove(mcp);
  registerMcpList(mcp);
  registerMcpDetect(mcp);
  registerMcpCleoCommands(mcp);
  registerMcpCleoCompatibilityCommands(mcp);
}
