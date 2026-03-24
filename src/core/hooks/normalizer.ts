/**
 * CAAMP Hooks Normalizer
 *
 * Translates between CAAMP canonical hook events and provider-native
 * event names. Provides query functions for hook support, cross-provider
 * comparison, and event normalization.
 *
 * This module follows the same pattern as `src/core/mcp/transforms.ts` —
 * a translation layer that lets consumers use one canonical interface
 * while CAAMP handles provider-specific differences.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveRegistryTemplatePath } from "../paths/standard.js";
import type {
  CanonicalEventDefinition,
  CanonicalHookEvent,
  CrossProviderMatrix,
  HookCategory,
  HookMapping,
  HookMappingsFile,
  HookSupportResult,
  HookSystemType,
  NormalizedHookEvent,
  ProviderHookProfile,
  ProviderHookSummary,
} from "./types.js";
import { CANONICAL_HOOK_EVENTS, HOOK_CATEGORIES } from "./types.js";

// ── Data Loading ────────────────────────────────────────────────────

let _mappings: HookMappingsFile | null = null;

function findMappingsPath(): string {
  const thisDir = dirname(fileURLToPath(import.meta.url));
  // src/core/hooks/ -> providers/hook-mappings.json
  return join(thisDir, "..", "..", "..", "providers", "hook-mappings.json");
}

function loadMappings(): HookMappingsFile {
  if (_mappings) return _mappings;
  const raw = readFileSync(findMappingsPath(), "utf-8");
  _mappings = JSON.parse(raw) as HookMappingsFile;
  return _mappings;
}

/** Reset cached data (for testing). */
export function resetHookMappings(): void {
  _mappings = null;
}

// ── Core Query Functions ────────────────────────────────────────────

/**
 * Get the canonical event definition (category, description, canBlock).
 */
export function getCanonicalEvent(event: CanonicalHookEvent): CanonicalEventDefinition {
  const data = loadMappings();
  return data.canonicalEvents[event];
}

/**
 * Get all canonical event definitions.
 */
export function getAllCanonicalEvents(): Record<CanonicalHookEvent, CanonicalEventDefinition> {
  return loadMappings().canonicalEvents;
}

/**
 * Get canonical events filtered by category.
 */
export function getCanonicalEventsByCategory(category: HookCategory): CanonicalHookEvent[] {
  const data = loadMappings();
  return CANONICAL_HOOK_EVENTS.filter(
    (event) => data.canonicalEvents[event].category === category,
  );
}

/**
 * Get the full hook profile for a provider.
 */
export function getProviderHookProfile(providerId: string): ProviderHookProfile | undefined {
  const data = loadMappings();
  return data.providerMappings[providerId];
}

/**
 * Get all provider IDs that have hook mappings.
 */
export function getMappedProviderIds(): string[] {
  return Object.keys(loadMappings().providerMappings);
}

// ── Normalization: Canonical → Native ───────────────────────────────

/**
 * Translate a CAAMP canonical event name to the provider's native name.
 *
 * @returns The native event name, or `null` if unsupported
 *
 * @example
 * ```typescript
 * toNative("PreToolUse", "claude-code");   // "PreToolUse"
 * toNative("PreToolUse", "gemini-cli");    // "BeforeTool"
 * toNative("PreToolUse", "cursor");        // "preToolUse"
 * toNative("PreToolUse", "kimi");          // null
 * ```
 */
export function toNative(
  canonical: CanonicalHookEvent,
  providerId: string,
): string | null {
  const profile = getProviderHookProfile(providerId);
  if (!profile) return null;
  const mapping = profile.mappings[canonical];
  return mapping?.supported ? mapping.nativeName : null;
}

/**
 * Translate a provider-native event name to the CAAMP canonical name.
 *
 * @returns The canonical event name, or `null` if no mapping exists
 *
 * @example
 * ```typescript
 * toCanonical("BeforeTool", "gemini-cli");     // "PreToolUse"
 * toCanonical("stop", "cursor");               // "ResponseComplete"
 * toCanonical("UserPromptSubmit", "claude-code"); // "PromptSubmit"
 * ```
 */
export function toCanonical(
  nativeName: string,
  providerId: string,
): CanonicalHookEvent | null {
  const profile = getProviderHookProfile(providerId);
  if (!profile) return null;

  for (const [canonical, mapping] of Object.entries(profile.mappings)) {
    if (mapping.supported && mapping.nativeName === nativeName) {
      return canonical as CanonicalHookEvent;
    }
  }
  return null;
}

/**
 * Batch-translate multiple canonical events to native names for a provider.
 *
 * @returns Array of normalized events (only supported ones included)
 */
export function toNativeBatch(
  canonicals: CanonicalHookEvent[],
  providerId: string,
): NormalizedHookEvent[] {
  const data = loadMappings();
  const profile = data.providerMappings[providerId];
  if (!profile) return [];

  const results: NormalizedHookEvent[] = [];
  for (const canonical of canonicals) {
    const mapping = profile.mappings[canonical];
    if (mapping?.supported && mapping.nativeName) {
      results.push({
        canonical,
        native: mapping.nativeName,
        providerId,
        category: data.canonicalEvents[canonical].category,
        canBlock: data.canonicalEvents[canonical].canBlock,
      });
    }
  }
  return results;
}

// ── Support Queries ─────────────────────────────────────────────────

/**
 * Check if a provider supports a specific canonical hook event.
 */
export function supportsHook(
  canonical: CanonicalHookEvent,
  providerId: string,
): boolean {
  const profile = getProviderHookProfile(providerId);
  if (!profile) return false;
  return profile.mappings[canonical]?.supported ?? false;
}

/**
 * Get full hook support details for a canonical event on a provider.
 */
export function getHookSupport(
  canonical: CanonicalHookEvent,
  providerId: string,
): HookSupportResult {
  const profile = getProviderHookProfile(providerId);
  if (!profile) {
    return { canonical, supported: false, native: null };
  }
  const mapping = profile.mappings[canonical];
  return {
    canonical,
    supported: mapping?.supported ?? false,
    native: mapping?.nativeName ?? null,
    notes: mapping?.notes,
  };
}

/**
 * Get all supported canonical events for a provider.
 */
export function getSupportedEvents(providerId: string): CanonicalHookEvent[] {
  const profile = getProviderHookProfile(providerId);
  if (!profile) return [];
  return CANONICAL_HOOK_EVENTS.filter(
    (event) => profile.mappings[event]?.supported,
  );
}

/**
 * Get all unsupported canonical events for a provider.
 */
export function getUnsupportedEvents(providerId: string): CanonicalHookEvent[] {
  const profile = getProviderHookProfile(providerId);
  if (!profile) return [...CANONICAL_HOOK_EVENTS];
  return CANONICAL_HOOK_EVENTS.filter(
    (event) => !profile.mappings[event]?.supported,
  );
}

/**
 * Get providers that support a specific canonical event.
 */
export function getProvidersForEvent(canonical: CanonicalHookEvent): string[] {
  const data = loadMappings();
  return Object.entries(data.providerMappings)
    .filter(([, profile]) => profile.mappings[canonical]?.supported)
    .map(([id]) => id);
}

/**
 * Get canonical events common to all specified providers.
 */
export function getCommonEvents(providerIds: string[]): CanonicalHookEvent[] {
  if (providerIds.length === 0) return [];
  return CANONICAL_HOOK_EVENTS.filter(
    (event) => providerIds.every((id) => supportsHook(event, id)),
  );
}

// ── Summary & Matrix Functions ──────────────────────────────────────

/**
 * Get a summary of hook support for a provider.
 */
export function getProviderSummary(providerId: string): ProviderHookSummary | undefined {
  const profile = getProviderHookProfile(providerId);
  if (!profile) return undefined;

  const supported = getSupportedEvents(providerId);
  const unsupported = getUnsupportedEvents(providerId);

  return {
    providerId,
    hookSystem: profile.hookSystem,
    experimental: profile.experimental,
    supportedCount: supported.length,
    totalCanonical: CANONICAL_HOOK_EVENTS.length,
    supported,
    unsupported,
    providerOnly: profile.providerOnlyEvents,
    coverage: Math.round((supported.length / CANONICAL_HOOK_EVENTS.length) * 100),
  };
}

/**
 * Build a cross-provider hook support matrix.
 *
 * Shows which canonical events are supported by which providers,
 * with native name translations.
 */
export function buildHookMatrix(providerIds?: string[]): CrossProviderMatrix {
  const data = loadMappings();
  const ids = providerIds ?? Object.keys(data.providerMappings);

  const matrix: Record<string, Record<string, HookMapping>> = {};
  for (const event of CANONICAL_HOOK_EVENTS) {
    matrix[event] = {};
    for (const id of ids) {
      const profile = data.providerMappings[id];
      matrix[event][id] = profile?.mappings[event] ?? {
        nativeName: null,
        supported: false,
      };
    }
  }

  return {
    events: [...CANONICAL_HOOK_EVENTS],
    providers: ids,
    matrix: matrix as CrossProviderMatrix["matrix"],
  };
}

/**
 * Get the hook system type for a provider.
 */
export function getHookSystemType(providerId: string): HookSystemType {
  const profile = getProviderHookProfile(providerId);
  return profile?.hookSystem ?? "none";
}

/**
 * Get the resolved hook config path for a provider.
 */
export function getHookConfigPath(providerId: string): string | null {
  const profile = getProviderHookProfile(providerId);
  if (!profile?.hookConfigPath) return null;
  return resolveRegistryTemplatePath(profile.hookConfigPath);
}

/**
 * Get provider-only events (native events with no canonical mapping).
 */
export function getProviderOnlyEvents(providerId: string): string[] {
  const profile = getProviderHookProfile(providerId);
  return profile?.providerOnlyEvents ?? [];
}

// ── Multi-Provider Translation ──────────────────────────────────────

/**
 * Translate a canonical event to native names across multiple providers.
 * Returns only providers that support the event.
 *
 * @example
 * ```typescript
 * const result = translateToAll("PreToolUse", ["claude-code", "gemini-cli", "kimi"]);
 * // { "claude-code": "PreToolUse", "gemini-cli": "BeforeTool" }
 * // (kimi excluded — unsupported)
 * ```
 */
export function translateToAll(
  canonical: CanonicalHookEvent,
  providerIds: string[],
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const id of providerIds) {
    const native = toNative(canonical, id);
    if (native) {
      result[id] = native;
    }
  }
  return result;
}

/**
 * Find the best canonical match for a native event name across all providers.
 * Useful when you have a native name but don't know which provider it's from.
 */
export function resolveNativeEvent(nativeName: string): Array<{
  providerId: string;
  canonical: CanonicalHookEvent;
}> {
  const data = loadMappings();
  const results: Array<{ providerId: string; canonical: CanonicalHookEvent }> = [];

  for (const [providerId, profile] of Object.entries(data.providerMappings)) {
    for (const [canonical, mapping] of Object.entries(profile.mappings)) {
      if (mapping.supported && mapping.nativeName === nativeName) {
        results.push({ providerId, canonical: canonical as CanonicalHookEvent });
      }
    }
  }

  return results;
}

/**
 * Get the version of the hook mappings data.
 */
export function getHookMappingsVersion(): string {
  return loadMappings().version;
}
