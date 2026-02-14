import { describe, it, expect } from "vitest";
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
});
