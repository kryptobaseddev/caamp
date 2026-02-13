/**
 * MCP command group registration
 */

import type { Command } from "commander";
import { registerMcpInstall } from "./install.js";
import { registerMcpRemove } from "./remove.js";
import { registerMcpList } from "./list.js";
import { registerMcpDetect } from "./detect.js";

export function registerMcpCommands(program: Command): void {
  const mcp = program
    .command("mcp")
    .description("Manage MCP server configurations");

  registerMcpInstall(mcp);
  registerMcpRemove(mcp);
  registerMcpList(mcp);
  registerMcpDetect(mcp);
}
