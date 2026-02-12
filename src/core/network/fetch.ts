export const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

type NetworkErrorKind = "timeout" | "http" | "network";

export class NetworkError extends Error {
  kind: NetworkErrorKind;
  url: string;
  status?: number;

  constructor(message: string, kind: NetworkErrorKind, url: string, status?: number) {
    super(message);
    this.name = "NetworkError";
    this.kind = kind;
    this.url = url;
    this.status = status;
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new NetworkError(`Request timed out after ${timeoutMs}ms`, "timeout", url);
    }
    throw new NetworkError("Network request failed", "network", url);
  }
}

export function ensureOkResponse(response: Response, url: string): Response {
  if (!response.ok) {
    throw new NetworkError(`Request failed with status ${response.status}`, "http", url, response.status);
  }
  return response;
}

export function formatNetworkError(error: unknown): string {
  if (error instanceof NetworkError) {
    if (error.kind === "timeout") {
      return "Network request timed out. Please check your connection and try again.";
    }
    if (error.kind === "http") {
      return `Marketplace request failed with HTTP ${error.status ?? "unknown"}. Please try again shortly.`;
    }
    return "Network request failed. Please check your connection and try again.";
  }

  if (error instanceof Error) return error.message;
  return String(error);
}
