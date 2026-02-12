/**
 * Simple logger with verbose/quiet mode support.
 *
 * - verbose: enables debug output to stderr
 * - quiet: suppresses info and warn output (errors always shown)
 */

let verboseMode = false;
let quietMode = false;

/**
 * Enable or disable verbose (debug) logging mode.
 *
 * When enabled, debug messages are written to stderr.
 *
 * @param v - `true` to enable verbose mode, `false` to disable
 *
 * @example
 * ```typescript
 * setVerbose(true);
 * ```
 */
export function setVerbose(v: boolean): void {
  verboseMode = v;
}

/**
 * Enable or disable quiet mode.
 *
 * When enabled, info and warning messages are suppressed. Errors are always shown.
 *
 * @param q - `true` to enable quiet mode, `false` to disable
 *
 * @example
 * ```typescript
 * setQuiet(true);
 * ```
 */
export function setQuiet(q: boolean): void {
  quietMode = q;
}

export function debug(...args: unknown[]): void {
  if (verboseMode) console.error("[debug]", ...args);
}

export function info(...args: unknown[]): void {
  if (!quietMode) console.log(...args);
}

export function warn(...args: unknown[]): void {
  if (!quietMode) console.warn(...args);
}

export function error(...args: unknown[]): void {
  console.error(...args);
}

/**
 * Check if verbose (debug) logging is currently enabled.
 *
 * @returns `true` if verbose mode is active
 *
 * @example
 * ```typescript
 * if (isVerbose()) {
 *   console.error("Extra debug info");
 * }
 * ```
 */
export function isVerbose(): boolean {
  return verboseMode;
}

/**
 * Check if quiet mode is currently enabled.
 *
 * @returns `true` if quiet mode is active
 *
 * @example
 * ```typescript
 * if (!isQuiet()) {
 *   console.log("Status message");
 * }
 * ```
 */
export function isQuiet(): boolean {
  return quietMode;
}
