/**
 * Advanced orchestration helpers for multi-provider operations.
 *
 * These helpers compose CAAMP's lower-level APIs into production patterns:
 * tier-based targeting, conflict-aware installs, and rollback-capable batches.
 */

import { existsSync, lstatSync } from "node:fs";
import {
  cp,
  mkdir,
  readFile,
  readlink,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import type {
  ConfigFormat,
  McpServerConfig,
  Provider,
  ProviderPriority,
} from "../../types.js";
import { injectAll } from "../instructions/injector.js";
import { groupByInstructFile } from "../instructions/templates.js";
import { installMcpServer, type InstallResult } from "../mcp/installer.js";
import { listMcpServers, resolveConfigPath } from "../mcp/reader.js";
import { CANONICAL_SKILLS_DIR } from "../paths/agents.js";
import { getTransform } from "../mcp/transforms.js";
import { getInstalledProviders } from "../registry/detection.js";
import { installSkill, removeSkill } from "../skills/installer.js";

type Scope = "project" | "global";

const PRIORITY_ORDER: Record<ProviderPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/**
 * Filter providers by minimum priority and return them in deterministic tier order.
 *
 * `minimumPriority = "medium"` returns `high` + `medium`.
 */
export function selectProvidersByMinimumPriority(
  providers: Provider[],
  minimumPriority: ProviderPriority = "low",
): Provider[] {
  const maxRank = PRIORITY_ORDER[minimumPriority];

  return [...providers]
    .filter((provider) => PRIORITY_ORDER[provider.priority] <= maxRank)
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}

/**
 * Single MCP operation entry used by batch orchestration.
 */
export interface McpBatchOperation {
  serverName: string;
  config: McpServerConfig;
  scope?: Scope;
}

/**
 * Single skill operation entry used by batch orchestration.
 */
export interface SkillBatchOperation {
  sourcePath: string;
  skillName: string;
  isGlobal?: boolean;
}

/**
 * Options for rollback-capable batch installation.
 */
export interface BatchInstallOptions {
  providers?: Provider[];
  minimumPriority?: ProviderPriority;
  mcp?: McpBatchOperation[];
  skills?: SkillBatchOperation[];
  projectDir?: string;
}

/**
 * Result of rollback-capable batch installation.
 */
export interface BatchInstallResult {
  success: boolean;
  providerIds: string[];
  mcpApplied: number;
  skillsApplied: number;
  rollbackPerformed: boolean;
  rollbackErrors: string[];
  error?: string;
}

interface SkillPathSnapshot {
  linkPath: string;
  state: "missing" | "symlink" | "directory" | "file";
  symlinkTarget?: string;
  backupPath?: string;
}

interface SkillSnapshot {
  skillName: string;
  isGlobal: boolean;
  canonicalPath: string;
  canonicalBackupPath?: string;
  canonicalExisted: boolean;
  pathSnapshots: SkillPathSnapshot[];
}

interface AppliedSkillInstall {
  skillName: string;
  isGlobal: boolean;
  linkedProviders: Provider[];
}

function resolveSkillLinkPath(
  provider: Provider,
  skillName: string,
  isGlobal: boolean,
  projectDir: string,
): string {
  const skillDir = isGlobal
    ? provider.pathSkills
    : join(projectDir, provider.pathProjectSkills);
  return join(skillDir, skillName);
}

async function snapshotConfigs(paths: string[]): Promise<Map<string, string | null>> {
  const snapshots = new Map<string, string | null>();

  for (const path of paths) {
    if (!path || snapshots.has(path)) continue;
    if (!existsSync(path)) {
      snapshots.set(path, null);
      continue;
    }
    snapshots.set(path, await readFile(path, "utf-8"));
  }

  return snapshots;
}

async function restoreConfigSnapshots(snapshots: Map<string, string | null>): Promise<void> {
  for (const [path, content] of snapshots) {
    if (content === null) {
      await rm(path, { force: true });
      continue;
    }

    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf-8");
  }
}

async function snapshotSkillState(
  providerTargets: Provider[],
  operation: SkillBatchOperation,
  projectDir: string,
  backupRoot: string,
): Promise<SkillSnapshot> {
  const skillName = operation.skillName;
  const isGlobal = operation.isGlobal ?? true;
  const canonicalPath = join(CANONICAL_SKILLS_DIR, skillName);
  const canonicalExisted = existsSync(canonicalPath);
  const canonicalBackupPath = join(backupRoot, "canonical", skillName);

  if (canonicalExisted) {
    await mkdir(dirname(canonicalBackupPath), { recursive: true });
    await cp(canonicalPath, canonicalBackupPath, { recursive: true });
  }

  const pathSnapshots: SkillPathSnapshot[] = [];
  for (const provider of providerTargets) {
    const linkPath = resolveSkillLinkPath(provider, skillName, isGlobal, projectDir);

    if (!existsSync(linkPath)) {
      pathSnapshots.push({ linkPath, state: "missing" });
      continue;
    }

    const stat = lstatSync(linkPath);

    if (stat.isSymbolicLink()) {
      pathSnapshots.push({
        linkPath,
        state: "symlink",
        symlinkTarget: await readlink(linkPath),
      });
      continue;
    }

    const backupPath = join(backupRoot, "links", provider.id, `${skillName}-${basename(linkPath)}`);
    await mkdir(dirname(backupPath), { recursive: true });

    if (stat.isDirectory()) {
      await cp(linkPath, backupPath, { recursive: true });
      pathSnapshots.push({ linkPath, state: "directory", backupPath });
      continue;
    }

    await cp(linkPath, backupPath);
    pathSnapshots.push({ linkPath, state: "file", backupPath });
  }

  return {
    skillName,
    isGlobal,
    canonicalPath,
    canonicalBackupPath: canonicalExisted ? canonicalBackupPath : undefined,
    canonicalExisted,
    pathSnapshots,
  };
}

async function restoreSkillSnapshot(snapshot: SkillSnapshot): Promise<void> {
  if (existsSync(snapshot.canonicalPath)) {
    await rm(snapshot.canonicalPath, { recursive: true, force: true });
  }

  if (snapshot.canonicalExisted && snapshot.canonicalBackupPath && existsSync(snapshot.canonicalBackupPath)) {
    await mkdir(dirname(snapshot.canonicalPath), { recursive: true });
    await cp(snapshot.canonicalBackupPath, snapshot.canonicalPath, { recursive: true });
  }

  for (const pathSnapshot of snapshot.pathSnapshots) {
    await rm(pathSnapshot.linkPath, { recursive: true, force: true });

    if (pathSnapshot.state === "missing") continue;

    await mkdir(dirname(pathSnapshot.linkPath), { recursive: true });

    if (pathSnapshot.state === "symlink" && pathSnapshot.symlinkTarget) {
      const linkType = process.platform === "win32" ? "junction" : "dir";
      await symlink(pathSnapshot.symlinkTarget, pathSnapshot.linkPath, linkType);
      continue;
    }

    if ((pathSnapshot.state === "directory" || pathSnapshot.state === "file") && pathSnapshot.backupPath) {
      if (pathSnapshot.state === "directory") {
        await cp(pathSnapshot.backupPath, pathSnapshot.linkPath, { recursive: true });
      } else {
        await cp(pathSnapshot.backupPath, pathSnapshot.linkPath);
      }
    }
  }
}

/**
 * Install multiple MCP servers and skills across filtered providers with rollback.
 *
 * Rollback behavior:
 * - MCP config files are restored exactly from snapshots.
 * - Skill state is restored for canonical skill dirs and targeted provider link paths.
 */
export async function installBatchWithRollback(
  options: BatchInstallOptions,
): Promise<BatchInstallResult> {
  const projectDir = options.projectDir ?? process.cwd();
  const minimumPriority = options.minimumPriority ?? "low";
  const mcpOps = options.mcp ?? [];
  const skillOps = options.skills ?? [];
  const baseProviders = options.providers ?? getInstalledProviders();
  const providers = selectProvidersByMinimumPriority(baseProviders, minimumPriority);

  const configPaths = providers.flatMap((provider) => {
    const paths: string[] = [];
    for (const operation of mcpOps) {
      const path = resolveConfigPath(provider, operation.scope ?? "project", projectDir);
      if (path) paths.push(path);
    }
    return paths;
  });

  const configSnapshots = await snapshotConfigs(configPaths);
  const backupRoot = join(
    tmpdir(),
    `caamp-skill-backup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );

  const skillSnapshots = await Promise.all(
    skillOps.map((operation) => snapshotSkillState(providers, operation, projectDir, backupRoot)),
  );

  const appliedSkills: AppliedSkillInstall[] = [];
  const rollbackErrors: string[] = [];
  let mcpApplied = 0;
  let skillsApplied = 0;
  let rollbackPerformed = false;

  try {
    for (const operation of mcpOps) {
      const scope = operation.scope ?? "project";
      for (const provider of providers) {
        const result = await installMcpServer(
          provider,
          operation.serverName,
          operation.config,
          scope,
          projectDir,
        );

        if (!result.success) {
          throw new Error(result.error ?? `Failed MCP install for ${provider.id}`);
        }
        mcpApplied += 1;
      }
    }

    for (const operation of skillOps) {
      const isGlobal = operation.isGlobal ?? true;
      const result = await installSkill(
        operation.sourcePath,
        operation.skillName,
        providers,
        isGlobal,
        projectDir,
      );

      const linkedProviders = providers.filter((provider) => result.linkedAgents.includes(provider.id));
      appliedSkills.push({
        skillName: operation.skillName,
        isGlobal,
        linkedProviders,
      });

      if (result.errors.length > 0) {
        throw new Error(result.errors.join("; "));
      }

      skillsApplied += 1;
    }

    await rm(backupRoot, { recursive: true, force: true });

    return {
      success: true,
      providerIds: providers.map((provider) => provider.id),
      mcpApplied,
      skillsApplied,
      rollbackPerformed: false,
      rollbackErrors: [],
    };
  } catch (error) {
    rollbackPerformed = true;

    for (const applied of [...appliedSkills].reverse()) {
      try {
        await removeSkill(applied.skillName, applied.linkedProviders, applied.isGlobal, projectDir);
      } catch (err) {
        rollbackErrors.push(err instanceof Error ? err.message : String(err));
      }
    }

    try {
      await restoreConfigSnapshots(configSnapshots);
    } catch (err) {
      rollbackErrors.push(err instanceof Error ? err.message : String(err));
    }

    for (const snapshot of skillSnapshots) {
      try {
        await restoreSkillSnapshot(snapshot);
      } catch (err) {
        rollbackErrors.push(err instanceof Error ? err.message : String(err));
      }
    }

    await rm(backupRoot, { recursive: true, force: true });

    return {
      success: false,
      providerIds: providers.map((provider) => provider.id),
      mcpApplied,
      skillsApplied,
      rollbackPerformed,
      rollbackErrors,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Conflict policy when applying MCP install plans.
 */
export type ConflictPolicy = "fail" | "skip" | "overwrite";

/**
 * MCP conflict code.
 */
export type McpConflictCode =
  | "unsupported-transport"
  | "unsupported-headers"
  | "existing-mismatch";

/**
 * Conflict detected during preflight.
 */
export interface McpConflict {
  providerId: string;
  serverName: string;
  scope: Scope;
  code: McpConflictCode;
  message: string;
}

/**
 * Result from applying install plan with conflict policy.
 */
export interface McpPlanApplyResult {
  conflicts: McpConflict[];
  applied: InstallResult[];
  skipped: Array<{
    providerId: string;
    serverName: string;
    scope: Scope;
    reason: McpConflictCode;
  }>;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

/**
 * Preflight conflict detection for MCP install plans across providers.
 */
export async function detectMcpConfigConflicts(
  providers: Provider[],
  operations: McpBatchOperation[],
  projectDir = process.cwd(),
): Promise<McpConflict[]> {
  const conflicts: McpConflict[] = [];

  for (const provider of providers) {
    for (const operation of operations) {
      const scope = operation.scope ?? "project";

      if (operation.config.type && !provider.supportedTransports.includes(operation.config.type)) {
        conflicts.push({
          providerId: provider.id,
          serverName: operation.serverName,
          scope,
          code: "unsupported-transport",
          message: `${provider.id} does not support transport ${operation.config.type}`,
        });
      }

      if (operation.config.headers && !provider.supportsHeaders) {
        conflicts.push({
          providerId: provider.id,
          serverName: operation.serverName,
          scope,
          code: "unsupported-headers",
          message: `${provider.id} does not support header configuration`,
        });
      }

      const existingEntries = await listMcpServers(provider, scope, projectDir);
      const current = existingEntries.find((entry) => entry.name === operation.serverName);
      if (!current) continue;

      const transform = getTransform(provider.id);
      const desired = transform
        ? transform(operation.serverName, operation.config)
        : operation.config;

      if (stableStringify(current.config) !== stableStringify(desired)) {
        conflicts.push({
          providerId: provider.id,
          serverName: operation.serverName,
          scope,
          code: "existing-mismatch",
          message: `${provider.id} has existing config mismatch for ${operation.serverName}`,
        });
      }
    }
  }

  return conflicts;
}

/**
 * Apply MCP install plan with a conflict policy.
 */
export async function applyMcpInstallWithPolicy(
  providers: Provider[],
  operations: McpBatchOperation[],
  policy: ConflictPolicy = "fail",
  projectDir = process.cwd(),
): Promise<McpPlanApplyResult> {
  const conflicts = await detectMcpConfigConflicts(providers, operations, projectDir);
  const conflictKey = (providerId: string, serverName: string, scope: Scope) => `${providerId}::${serverName}::${scope}`;
  const conflictMap = new Map<string, McpConflict>();
  for (const conflict of conflicts) {
    conflictMap.set(conflictKey(conflict.providerId, conflict.serverName, conflict.scope), conflict);
  }

  if (policy === "fail" && conflicts.length > 0) {
    return { conflicts, applied: [], skipped: [] };
  }

  const applied: InstallResult[] = [];
  const skipped: McpPlanApplyResult["skipped"] = [];

  for (const provider of providers) {
    for (const operation of operations) {
      const scope = operation.scope ?? "project";
      const key = conflictKey(provider.id, operation.serverName, scope);
      const conflict = conflictMap.get(key);

      if (policy === "skip" && conflict) {
        skipped.push({
          providerId: provider.id,
          serverName: operation.serverName,
          scope,
          reason: conflict.code,
        });
        continue;
      }

      const result = await installMcpServer(
        provider,
        operation.serverName,
        operation.config,
        scope,
        projectDir,
      );
      applied.push(result);
    }
  }

  return { conflicts, applied, skipped };
}

/**
 * Result of a single-operation instruction update across providers.
 */
export interface InstructionUpdateSummary {
  scope: Scope;
  updatedFiles: number;
  actions: Array<{
    file: string;
    action: "created" | "added" | "updated";
    providers: string[];
    configFormats: ConfigFormat[];
  }>;
}

/**
 * Update instruction files across providers as a single operation.
 *
 * Works the same regardless of provider config format (JSON/YAML/TOML/JSONC)
 * because instruction files are handled through CAAMP markers.
 */
export async function updateInstructionsSingleOperation(
  providers: Provider[],
  content: string,
  scope: Scope = "project",
  projectDir = process.cwd(),
): Promise<InstructionUpdateSummary> {
  const actions = await injectAll(providers, projectDir, scope, content);
  const groupedByFile = groupByInstructFile(providers);

  const summary: InstructionUpdateSummary = {
    scope,
    updatedFiles: actions.size,
    actions: [],
  };

  for (const [filePath, action] of actions.entries()) {
    const providersForFile = providers.filter((provider) => {
      const expectedPath = scope === "global"
        ? join(provider.pathGlobal, provider.instructFile)
        : join(projectDir, provider.instructFile);
      return expectedPath === filePath;
    });

    const fallback = groupedByFile.get(basename(filePath)) ?? [];
    const selected = providersForFile.length > 0 ? providersForFile : fallback;

    summary.actions.push({
      file: filePath,
      action,
      providers: selected.map((provider) => provider.id),
      configFormats: Array.from(new Set(selected.map((provider) => provider.configFormat))),
    });
  }

  return summary;
}

/**
 * Request payload for dual-scope provider configuration.
 */
export interface DualScopeConfigureOptions {
  globalMcp?: Array<{ serverName: string; config: McpServerConfig }>;
  projectMcp?: Array<{ serverName: string; config: McpServerConfig }>;
  instructionContent?: string | { global?: string; project?: string };
  projectDir?: string;
}

/**
 * Result of dual-scope provider configuration.
 */
export interface DualScopeConfigureResult {
  providerId: string;
  configPaths: {
    global: string | null;
    project: string | null;
  };
  mcp: {
    global: InstallResult[];
    project: InstallResult[];
  };
  instructions: {
    global?: Map<string, "created" | "added" | "updated">;
    project?: Map<string, "created" | "added" | "updated">;
  };
}

/**
 * Configure both global and project-level settings for one provider in one call.
 */
export async function configureProviderGlobalAndProject(
  provider: Provider,
  options: DualScopeConfigureOptions,
): Promise<DualScopeConfigureResult> {
  const projectDir = options.projectDir ?? process.cwd();
  const globalOps = options.globalMcp ?? [];
  const projectOps = options.projectMcp ?? [];

  const globalResults: InstallResult[] = [];
  for (const operation of globalOps) {
    globalResults.push(await installMcpServer(
      provider,
      operation.serverName,
      operation.config,
      "global",
      projectDir,
    ));
  }

  const projectResults: InstallResult[] = [];
  for (const operation of projectOps) {
    projectResults.push(await installMcpServer(
      provider,
      operation.serverName,
      operation.config,
      "project",
      projectDir,
    ));
  }

  const instructionResults: DualScopeConfigureResult["instructions"] = {};
  const instructionContent = options.instructionContent;
  if (typeof instructionContent === "string") {
    instructionResults.global = await injectAll([provider], projectDir, "global", instructionContent);
    instructionResults.project = await injectAll([provider], projectDir, "project", instructionContent);
  } else if (instructionContent) {
    if (instructionContent.global) {
      instructionResults.global = await injectAll([provider], projectDir, "global", instructionContent.global);
    }
    if (instructionContent.project) {
      instructionResults.project = await injectAll([provider], projectDir, "project", instructionContent.project);
    }
  }

  return {
    providerId: provider.id,
    configPaths: {
      global: resolveConfigPath(provider, "global", projectDir),
      project: resolveConfigPath(provider, "project", projectDir),
    },
    mcp: {
      global: globalResults,
      project: projectResults,
    },
    instructions: instructionResults,
  };
}
