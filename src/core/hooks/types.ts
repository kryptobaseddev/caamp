/**
 * CAAMP Hooks Normalizer - Type Definitions
 *
 * Defines the canonical CAAMP hook event taxonomy and provider mapping types.
 * CAAMP provides a unified hook interface across all providers — consumers
 * use canonical event names, and the normalizer translates to/from
 * provider-native names.
 */

// ── Canonical Hook Events ───────────────────────────────────────────

export const HOOK_CATEGORIES = ["session", "prompt", "tool", "agent", "context"] as const;
export type HookCategory = (typeof HOOK_CATEGORIES)[number];

export const CANONICAL_HOOK_EVENTS = [
  "SessionStart",
  "SessionEnd",
  "PromptSubmit",
  "ResponseComplete",
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "PermissionRequest",
  "SubagentStart",
  "SubagentStop",
  "PreModel",
  "PostModel",
  "PreCompact",
  "PostCompact",
  "Notification",
  "ConfigChange",
] as const;

export type CanonicalHookEvent = (typeof CANONICAL_HOOK_EVENTS)[number];

export interface CanonicalEventDefinition {
  category: HookCategory;
  description: string;
  canBlock: boolean;
}

// ── Provider Hook System Types ──────────────────────────────────────

export type HookSystemType = "config" | "plugin" | "none";
export type HookHandlerType = "command" | "http" | "prompt" | "agent" | "plugin";

export interface HookMapping {
  nativeName: string | null;
  supported: boolean;
  notes?: string;
}

export interface ProviderHookProfile {
  hookSystem: HookSystemType;
  hookConfigPath: string | null;
  hookFormat: string | null;
  handlerTypes: HookHandlerType[];
  experimental: boolean;
  mappings: Record<CanonicalHookEvent, HookMapping>;
  providerOnlyEvents: string[];
}

// ── Normalization Result Types ──────────────────────────────────────

export interface NormalizedHookEvent {
  canonical: CanonicalHookEvent;
  native: string;
  providerId: string;
  category: HookCategory;
  canBlock: boolean;
}

export interface HookSupportResult {
  canonical: CanonicalHookEvent;
  supported: boolean;
  native: string | null;
  notes?: string;
}

export interface ProviderHookSummary {
  providerId: string;
  hookSystem: HookSystemType;
  experimental: boolean;
  supportedCount: number;
  totalCanonical: number;
  supported: CanonicalHookEvent[];
  unsupported: CanonicalHookEvent[];
  providerOnly: string[];
  coverage: number;
}

export interface CrossProviderMatrix {
  events: CanonicalHookEvent[];
  providers: string[];
  matrix: Record<CanonicalHookEvent, Record<string, HookMapping>>;
}

// ── Hook Mappings Data File Types ───────────────────────────────────

export interface HookMappingsFile {
  version: string;
  lastUpdated: string;
  description: string;
  canonicalEvents: Record<CanonicalHookEvent, CanonicalEventDefinition>;
  providerMappings: Record<string, ProviderHookProfile>;
}
