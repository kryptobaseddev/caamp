/**
 * Spawn adapter interface for provider-neutral subagent orchestration.
 *
 * This is an interface-only module — no concrete implementations yet.
 * CLEO will consume this interface to build provider-specific adapters.
 */

import type { Provider } from "../../types.js";

/**
 * Options for spawning a subagent.
 */
export interface SpawnOptions {
  /** The prompt or instruction to give the spawned agent. */
  prompt: string;
  /** Model to use for the spawned agent. */
  model?: string;
  /** Tools to make available to the spawned agent. */
  tools?: string[];
  /** Timeout in milliseconds for the spawned agent. */
  timeout?: number;
  /** Whether to isolate the spawned agent (e.g. in a worktree). */
  isolate?: boolean;
}

/**
 * Result from a spawn operation.
 */
export interface SpawnResult {
  /** Unique identifier for the spawned agent instance. */
  instanceId: string;
  /** Current status of the spawned agent. */
  status: "running" | "completed" | "failed";
  /** Output produced by the spawned agent. */
  output?: string;
}

/**
 * Provider-neutral interface for spawning and managing subagents.
 *
 * Concrete implementations will be provider-specific (e.g. ClaudeCodeSpawnAdapter,
 * CodexSpawnAdapter) and registered by CLEO's orchestration layer.
 */
export interface SpawnAdapter {
  /** Check if a provider supports spawning via this adapter. */
  canSpawn(provider: Provider): boolean;
  /** Spawn a new subagent for the given provider. */
  spawn(provider: Provider, options: SpawnOptions): Promise<SpawnResult>;
  /** List currently running subagent instances. */
  listRunning(provider: Provider): Promise<SpawnResult[]>;
  /** Terminate a running subagent instance. */
  terminate(provider: Provider, instanceId: string): Promise<void>;
}
