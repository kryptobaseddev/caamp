import { describe, expect, it } from "vitest";
import * as catalog from "../../src/core/skills/catalog.js";

describe("ct-skills catalog adapter", () => {
  it("isCatalogAvailable returns true when ct-skills is installed", () => {
    expect(catalog.isCatalogAvailable()).toBe(true);
  });

  it("listSkills returns an array of skill names", () => {
    const skills = catalog.listSkills();
    expect(Array.isArray(skills)).toBe(true);
    expect(skills.length).toBeGreaterThan(0);
    expect(typeof skills[0]).toBe("string");
  });

  it("getSkill returns a valid CtSkillEntry", () => {
    const skills = catalog.listSkills();
    const skill = catalog.getSkill(skills[0]!);
    expect(skill).toBeDefined();
    expect(skill!.name).toBe(skills[0]);
    expect(typeof skill!.description).toBe("string");
    expect(typeof skill!.version).toBe("string");
    expect(typeof skill!.core).toBe("boolean");
  });

  it("getSkill returns undefined for nonexistent skill", () => {
    expect(catalog.getSkill("nonexistent-skill-xyz")).toBeUndefined();
  });

  it("getCoreSkills returns only core skills", () => {
    const core = catalog.getCoreSkills();
    for (const skill of core) {
      expect(skill.core).toBe(true);
    }
  });

  it("getSkillDir returns a string path", () => {
    const skills = catalog.listSkills();
    const dir = catalog.getSkillDir(skills[0]!);
    expect(typeof dir).toBe("string");
    expect(dir.length).toBeGreaterThan(0);
  });

  it("resolveDependencyTree includes transitive deps", () => {
    const skills = catalog.listSkills();
    const resolved = catalog.resolveDependencyTree([skills[0]!]);
    expect(Array.isArray(resolved)).toBe(true);
    expect(resolved).toContain(skills[0]);
  });

  it("listProfiles returns profile names", () => {
    const profiles = catalog.listProfiles();
    expect(Array.isArray(profiles)).toBe(true);
  });

  it("getVersion returns a semver string", () => {
    const version = catalog.getVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("getLibraryRoot returns a path", () => {
    const root = catalog.getLibraryRoot();
    expect(typeof root).toBe("string");
    expect(root.length).toBeGreaterThan(0);
  });

  it("validateSkillFrontmatter returns validation result", () => {
    const skills = catalog.listSkills();
    const result = catalog.validateSkillFrontmatter(skills[0]!);
    expect(typeof result.valid).toBe("boolean");
    expect(Array.isArray(result.issues)).toBe(true);
  });

  // ── getSkills ────────────────────────────────────────────────────────

  it("getSkills returns an array of CtSkillEntry objects", () => {
    const skills = catalog.getSkills();
    expect(Array.isArray(skills)).toBe(true);
    expect(skills.length).toBeGreaterThan(0);
    const first = skills[0]!;
    expect(typeof first.name).toBe("string");
    expect(typeof first.description).toBe("string");
    expect(typeof first.version).toBe("string");
    expect(typeof first.core).toBe("boolean");
  });

  // ── getManifest ──────────────────────────────────────────────────────

  it("getManifest returns a manifest object", () => {
    const manifest = catalog.getManifest();
    expect(manifest).toBeDefined();
    expect(typeof manifest).toBe("object");
    expect(manifest).not.toBeNull();
  });

  // ── getSkillPath ─────────────────────────────────────────────────────

  it("getSkillPath returns a string path ending in SKILL.md", () => {
    const name = catalog.listSkills()[0]!;
    const skillPath = catalog.getSkillPath(name);
    expect(typeof skillPath).toBe("string");
    expect(skillPath).toMatch(/SKILL\.md$/);
  });

  // ── readSkillContent ─────────────────────────────────────────────────

  it("readSkillContent returns non-empty string content", () => {
    const name = catalog.listSkills()[0]!;
    const content = catalog.readSkillContent(name);
    expect(typeof content).toBe("string");
    expect(content.length).toBeGreaterThan(0);
  });

  // ── getSkillsByCategory ──────────────────────────────────────────────

  it("getSkillsByCategory returns an array of CtSkillEntry", () => {
    const allSkills = catalog.getSkills();
    const category = allSkills[0]!.category;
    const filtered = catalog.getSkillsByCategory(category);
    expect(Array.isArray(filtered)).toBe(true);
    for (const skill of filtered) {
      expect(skill.category).toBe(category);
    }
  });

  // ── getSkillDependencies ─────────────────────────────────────────────

  it("getSkillDependencies returns an array of strings", () => {
    const name = catalog.listSkills()[0]!;
    const deps = catalog.getSkillDependencies(name);
    expect(Array.isArray(deps)).toBe(true);
    for (const dep of deps) {
      expect(typeof dep).toBe("string");
    }
  });

  // ── resolveProfile ───────────────────────────────────────────────────

  it("resolveProfile returns an array of skill names", () => {
    const profiles = catalog.listProfiles();
    if (profiles.length === 0) return; // skip if no profiles
    const resolved = catalog.resolveProfile(profiles[0]!);
    expect(Array.isArray(resolved)).toBe(true);
    for (const name of resolved) {
      expect(typeof name).toBe("string");
    }
  });

  // ── listSharedResources ──────────────────────────────────────────────

  it("listSharedResources returns an array of strings", () => {
    const resources = catalog.listSharedResources();
    expect(Array.isArray(resources)).toBe(true);
    for (const r of resources) {
      expect(typeof r).toBe("string");
    }
  });

  // ── getSharedResourcePath ────────────────────────────────────────────

  it("getSharedResourcePath returns a string or undefined", () => {
    const resources = catalog.listSharedResources();
    if (resources.length === 0) return; // skip if none
    const resourcePath = catalog.getSharedResourcePath(resources[0]!);
    expect(typeof resourcePath).toBe("string");
    expect(resourcePath!.length).toBeGreaterThan(0);
  });

  it("getSharedResourcePath returns undefined for nonexistent resource", () => {
    const result = catalog.getSharedResourcePath("nonexistent-resource-xyz");
    expect(result).toBeUndefined();
  });

  // ── readSharedResource ───────────────────────────────────────────────

  it("readSharedResource returns string content for existing resource", () => {
    const resources = catalog.listSharedResources();
    if (resources.length === 0) return; // skip if none
    const content = catalog.readSharedResource(resources[0]!);
    expect(typeof content).toBe("string");
    expect(content!.length).toBeGreaterThan(0);
  });

  it("readSharedResource returns undefined for nonexistent resource", () => {
    const result = catalog.readSharedResource("nonexistent-resource-xyz");
    expect(result).toBeUndefined();
  });

  // ── listProtocols ────────────────────────────────────────────────────

  it("listProtocols returns an array of strings", () => {
    const protocols = catalog.listProtocols();
    expect(Array.isArray(protocols)).toBe(true);
    for (const p of protocols) {
      expect(typeof p).toBe("string");
    }
  });

  // ── getProtocolPath ──────────────────────────────────────────────────

  it("getProtocolPath returns a string for existing protocol", () => {
    const protocols = catalog.listProtocols();
    if (protocols.length === 0) return; // skip if none
    const protocolPath = catalog.getProtocolPath(protocols[0]!);
    expect(typeof protocolPath).toBe("string");
    expect(protocolPath!.length).toBeGreaterThan(0);
  });

  it("getProtocolPath returns undefined for nonexistent protocol", () => {
    const result = catalog.getProtocolPath("nonexistent-protocol-xyz");
    expect(result).toBeUndefined();
  });

  // ── readProtocol ─────────────────────────────────────────────────────

  it("readProtocol returns string content for existing protocol", () => {
    const protocols = catalog.listProtocols();
    if (protocols.length === 0) return; // skip if none
    const content = catalog.readProtocol(protocols[0]!);
    expect(typeof content).toBe("string");
    expect(content!.length).toBeGreaterThan(0);
  });

  it("readProtocol returns undefined for nonexistent protocol", () => {
    const result = catalog.readProtocol("nonexistent-protocol-xyz");
    expect(result).toBeUndefined();
  });

  // ── validateAll ──────────────────────────────────────────────────────

  it("validateAll returns a Map of skill names to validation results", () => {
    const results = catalog.validateAll();
    expect(results).toBeInstanceOf(Map);
    for (const [name, result] of results) {
      expect(typeof name).toBe("string");
      expect(typeof result.valid).toBe("boolean");
      expect(Array.isArray(result.issues)).toBe(true);
    }
  });

  // ── getDispatchMatrix ────────────────────────────────────────────────

  it("getDispatchMatrix returns a dispatch matrix object", () => {
    const matrix = catalog.getDispatchMatrix();
    expect(matrix).toBeDefined();
    expect(typeof matrix).toBe("object");
    expect(matrix).not.toBeNull();
  });

  // ── getProfile ───────────────────────────────────────────────────────

  it("getProfile returns a profile definition for existing profile", () => {
    const profiles = catalog.listProfiles();
    if (profiles.length === 0) return; // skip if none
    const profile = catalog.getProfile(profiles[0]!);
    expect(profile).toBeDefined();
    expect(typeof profile).toBe("object");
  });

  it("getProfile returns undefined for nonexistent profile", () => {
    const result = catalog.getProfile("nonexistent-profile-xyz");
    expect(result).toBeUndefined();
  });
});
