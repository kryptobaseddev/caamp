/**
 * LAFS-compliant output helpers for advanced CLI commands.
 */

import { randomUUID } from "node:crypto";
import {
  isRegisteredErrorCode,
  type LAFSEnvelope as ProtocolEnvelope,
  type LAFSErrorCategory,
} from "@cleocode/lafs-protocol";

interface LAFSErrorShape {
  code: string;
  message: string;
  category: LAFSErrorCategory;
  retryable: boolean;
  retryAfterMs: number | null;
  details: Record<string, unknown>;
}

interface LAFSPage {
  mode: "offset" | "cursor" | "none";
  limit: number;
  offset: number;
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}

export interface LAFSEnvelope<T> {
  $schema: string;
  _meta: {
    specVersion: string;
    schemaVersion: string;
    timestamp: string;
    operation: string;
    requestId: string;
    transport: "cli";
    strict: true;
    mvi: boolean;
    contextVersion: number;
  };
  success: boolean;
  result: T | null;
  error: LAFSErrorShape | null;
  page: LAFSPage | null;
}

type LAFSResultEnvelope<T> = Omit<ProtocolEnvelope, "result" | "error"> & {
  result: T | null;
  error: LAFSErrorShape | null;
};

export class LAFSCommandError extends Error {
  code: string;
  category: LAFSErrorCategory;
  recoverable: boolean;
  suggestion: string;
  retryAfterMs: number | null;
  details?: unknown;

  constructor(
    code: string,
    message: string,
    suggestion: string,
    recoverable = true,
    details?: unknown,
  ) {
    super(message);
    this.name = "LAFSCommandError";
    this.code = code;
    this.category = inferErrorCategory(code);
    this.recoverable = recoverable;
    this.suggestion = suggestion;
    this.retryAfterMs = null;
    this.details = details;
  }
}

function inferErrorCategory(code: string): LAFSErrorCategory {
  if (code.includes("VALIDATION")) return "VALIDATION";
  if (code.includes("NOT_FOUND")) return "NOT_FOUND";
  if (code.includes("CONFLICT")) return "CONFLICT";
  if (code.includes("AUTH")) return "AUTH";
  if (code.includes("PERMISSION")) return "PERMISSION";
  if (code.includes("RATE_LIMIT")) return "RATE_LIMIT";
  if (code.includes("MIGRATION")) return "MIGRATION";
  if (code.includes("CONTRACT")) return "CONTRACT";
  return "INTERNAL";
}

function baseMeta(operation: string, mvi: boolean) {
  return {
    specVersion: "1.0.0",
    schemaVersion: "1.0.0",
    timestamp: new Date().toISOString(),
    operation,
    requestId: randomUUID(),
    transport: "cli" as const,
    strict: true as const,
    mvi,
    contextVersion: 0,
  };
}

export function emitSuccess<T>(operation: string, result: T, mvi = true): void {
  const envelope: LAFSResultEnvelope<T> = {
    $schema: "https://lafs.dev/schemas/v1/envelope.schema.json",
    _meta: {
      ...baseMeta(operation, mvi),
    },
    success: true,
    result,
    error: null,
    page: null,
  };
  console.log(JSON.stringify(envelope, null, 2));
}

export function emitError(operation: string, error: unknown, mvi = true): void {
  let envelope: LAFSResultEnvelope<null>;

  if (error instanceof LAFSCommandError) {
    envelope = {
      $schema: "https://lafs.dev/schemas/v1/envelope.schema.json",
      _meta: {
        ...baseMeta(operation, mvi),
      },
      success: false,
      result: null,
      error: {
        code: isRegisteredErrorCode(error.code) ? error.code : "E_INTERNAL_UNEXPECTED",
        message: error.message,
        category: error.category,
        retryable: error.recoverable,
        retryAfterMs: error.retryAfterMs,
        details: {
          hint: error.suggestion,
          ...(error.details !== undefined ? { payload: error.details } : {}),
        },
      },
      page: null,
    };
  } else {
    envelope = {
      $schema: "https://lafs.dev/schemas/v1/envelope.schema.json",
      _meta: {
        ...baseMeta(operation, mvi),
      },
      success: false,
      result: null,
      error: {
        code: "E_INTERNAL_UNEXPECTED",
        message: error instanceof Error ? error.message : String(error),
        category: "INTERNAL",
        retryable: false,
        retryAfterMs: null,
        details: {
          hint: "Rerun with --verbose and validate your inputs.",
        },
      },
      page: null,
    };
  }

  console.error(JSON.stringify(envelope, null, 2));
}

export async function runLafsCommand<T>(
  command: string,
  mvi: boolean,
  action: () => Promise<T>,
): Promise<void> {
  try {
    const result = await action();
    emitSuccess(command, result, mvi);
  } catch (error) {
    emitError(command, error, mvi);
    process.exit(1);
  }
}
