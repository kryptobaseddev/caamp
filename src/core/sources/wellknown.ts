/**
 * RFC 8615 well-known skills discovery
 *
 * Checks /.well-known/skills/ on websites for skill definitions.
 */

import { fetchWithTimeout } from "../network/fetch.js";

export interface WellKnownSkill {
  name: string;
  description: string;
  url: string;
}

/** Discover skills from a well-known URL */
export async function discoverWellKnown(domain: string): Promise<WellKnownSkill[]> {
  const url = `https://${domain}/.well-known/skills/index.json`;

  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) return [];

    const data = (await response.json()) as { skills?: WellKnownSkill[] };
    return data.skills ?? [];
  } catch {
    return [];
  }
}
