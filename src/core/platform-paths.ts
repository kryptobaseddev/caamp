/**
 * Central OS platform path resolution using env-paths.
 *
 * Provides OS-appropriate paths for CAAMP's global directories using
 * XDG conventions on Linux, standard conventions on macOS/Windows.
 * Results are cached for the process lifetime. Env vars take precedence.
 *
 * Platform path defaults:
 *   data:   ~/.local/share/agents  | ~/Library/Application Support/agents | %LOCALAPPDATA%\agents\Data
 *   config: ~/.config/agents       | ~/Library/Preferences/agents          | %APPDATA%\agents\Config
 *   cache:  ~/.cache/agents        | ~/Library/Caches/agents               | %LOCALAPPDATA%\agents\Cache
 *   log:    ~/.local/state/agents  | ~/Library/Logs/agents                 | %LOCALAPPDATA%\agents\Log
 *   temp:   /tmp/<user>/agents     | /var/folders/.../agents               | %TEMP%\agents
 *
 * AGENTS_HOME env var overrides the data path for backward compatibility
 * with existing ~/.agents installations.
 */

import envPaths from 'env-paths';
import { arch, homedir, hostname, platform, release } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';

const APP_NAME = 'agents';

/**
 * Normalize an AGENTS_HOME env var value to an absolute path.
 * Returns undefined when the value is absent, empty, or whitespace-only
 * (callers should fall back to the OS default in that case).
 */
function resolveAgentsHomeOverride(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed === '~') return homedir();
  if (trimmed.startsWith('~/')) return join(homedir(), trimmed.slice(2));
  if (isAbsolute(trimmed)) return resolve(trimmed);
  return resolve(homedir(), trimmed);
}

export interface PlatformPaths {
  /** User data dir. Override with AGENTS_HOME env var. */
  data: string;
  /** OS config dir (XDG_CONFIG_HOME / Library/Preferences / %APPDATA%). */
  config: string;
  /** OS cache dir. */
  cache: string;
  /** OS log dir. */
  log: string;
  /** OS temp dir. */
  temp: string;
}

export interface SystemInfo {
  platform: NodeJS.Platform;
  arch: string;
  release: string;
  hostname: string;
  nodeVersion: string;
  paths: PlatformPaths;
}

let _paths: PlatformPaths | null = null;
let _sysInfo: SystemInfo | null = null;
let _lastAgentsHome: string | undefined = undefined;

/**
 * Get OS-appropriate paths for CAAMP's global directories.
 * Cached after first call. AGENTS_HOME env var overrides the data path.
 * Cache auto-invalidates when AGENTS_HOME changes (supports test isolation).
 */
export function getPlatformPaths(): PlatformPaths {
  const currentAgentsHome = process.env['AGENTS_HOME'];

  // Invalidate if AGENTS_HOME changed since last cache build
  if (_paths && currentAgentsHome !== _lastAgentsHome) {
    _paths = null;
    _sysInfo = null;
  }

  if (_paths) return _paths;

  const ep = envPaths(APP_NAME, { suffix: '' });
  _lastAgentsHome = currentAgentsHome;

  _paths = {
    data: resolveAgentsHomeOverride(currentAgentsHome) ?? ep.data,
    config: ep.config,
    cache: ep.cache,
    log: ep.log,
    temp: ep.temp,
  };

  return _paths;
}

/**
 * Get a cached system information snapshot.
 * Captured once and reused for the process lifetime.
 */
export function getSystemInfo(): SystemInfo {
  if (_sysInfo) return _sysInfo;

  const paths = getPlatformPaths();

  _sysInfo = {
    platform: platform(),
    arch: arch(),
    release: release(),
    hostname: hostname(),
    nodeVersion: process.version,
    paths,
  };

  return _sysInfo;
}

/**
 * Invalidate the path and system info caches.
 * Use in tests after mutating AGENTS_HOME env var.
 * @internal
 */
export function _resetPlatformPathsCache(): void {
  _paths = null;
  _sysInfo = null;
  _lastAgentsHome = undefined;
}
