/**
 * LAFS-compliant output helpers for advanced CLI commands.
 */

import { randomUUID } from "node:crypto";
import {
  isRegisteredErrorCode,
  type LAFSErrorCategory,
  type LAFSMeta,
  type LAFSError,
  type LAFSPage,
  type MVILevel,
} from "@cleocode/lafs-protocol";

/**
 * Generic LAFS result envelope for advanced commands.
 * Uses protocol types directly for full compliance.
 */
type LAFSResultEnvelope<T> = {
  $schema: "https://lafs.dev/schemas/v1/envelope.schema.json";
  _meta: LAFSMeta;
  success: boolean;
  result: T | null;
  error: LAFSError | null;
  page: LAFSPage | null;
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

function baseMeta(operation: string, mvi: MVILevel): LAFSMeta {
  return {
    specVersion: "1.0.0",
    schemaVersion: "1.0.0",
    timestamp: new Date().toISOString(),
    operation,
    requestId: randomUUID(),
    transport: "cli",
    strict: true,
    mvi,
    contextVersion: 0,
  };
}

export function emitSuccess<T>(operation: string, result: T, mvi: MVILevel = "standard"): void {
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

export function emitError(operation: string, error: unknown, mvi: MVILevel = "standard"): void {
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
  mvi: MVILevel,
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
