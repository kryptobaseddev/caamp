import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, readFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeJsonConfig, readJsonConfig, removeJsonConfig } from "../../src/core/formats/json.js";
import { writeYamlConfig, readYamlConfig } from "../../src/core/formats/yaml.js";
import { deepMerge, setNestedValue, getNestedValue } from "../../src/core/formats/utils.js";

let testDir: string;

beforeEach(async () => {
  testDir = join(tmpdir(), `caamp-test-${Date.now()}`);
  await mkdir(testDir, { recursive: true });
});

afterEach(async () => {
  await rm(testDir, { recursive: true }).catch(() => {});
});

describe("deepMerge", () => {
  it("merges flat objects", () => {
    const result = deepMerge({ a: 1, b: 2 }, { b: 3, c: 4 });
    expect(result).toEqual({ a: 1, b: 3, c: 4 });
  });

  it("deep merges nested objects", () => {
    const result = deepMerge(
      { a: { x: 1, y: 2 } },
      { a: { y: 3, z: 4 } },
    );
    expect(result).toEqual({ a: { x: 1, y: 3, z: 4 } });
  });

  it("replaces arrays", () => {
    const result = deepMerge({ a: [1, 2] }, { a: [3, 4] });
    expect(result).toEqual({ a: [3, 4] });
  });

  it("handles null and undefined", () => {
    const result = deepMerge({ a: 1 }, { a: null } as Record<string, unknown>);
    expect(result.a).toBeNull();
  });
});

describe("setNestedValue", () => {
  it("sets value at simple key", () => {
    const result = setNestedValue({}, "servers", "test", { url: "http://localhost" });
    expect(result).toEqual({ servers: { test: { url: "http://localhost" } } });
  });

  it("sets value at dot-notation path", () => {
    const result = setNestedValue({}, "context_servers", "test", { source: "custom" });
    expect(result).toEqual({ context_servers: { test: { source: "custom" } } });
  });

  it("preserves existing values", () => {
    const existing = { servers: { existing: { command: "test" } } };
    const result = setNestedValue(existing, "servers", "new", { command: "new" });
    expect(result.servers).toEqual({
      existing: { command: "test" },
      new: { command: "new" },
    });
  });
});

describe("getNestedValue", () => {
  it("gets value at simple key", () => {
    expect(getNestedValue({ a: 1 }, "a")).toBe(1);
  });

  it("gets value at dot-notation path", () => {
    expect(getNestedValue({ a: { b: { c: 42 } } }, "a.b.c")).toBe(42);
  });

  it("returns undefined for missing path", () => {
    expect(getNestedValue({ a: 1 }, "b")).toBeUndefined();
    expect(getNestedValue({ a: 1 }, "a.b")).toBeUndefined();
  });
});

describe("JSON Format", () => {
  it("creates new config file", async () => {
    const filePath = join(testDir, "test.json");
    await writeJsonConfig(filePath, "mcpServers", "test", { command: "npx", args: ["-y", "test"] });

    const content = JSON.parse(await readFile(filePath, "utf-8"));
    expect(content.mcpServers.test).toEqual({ command: "npx", args: ["-y", "test"] });
  });

  it("preserves existing servers", async () => {
    const filePath = join(testDir, "test.json");
    await writeFile(filePath, JSON.stringify({ mcpServers: { existing: { command: "old" } } }, null, 2));

    await writeJsonConfig(filePath, "mcpServers", "new", { command: "npx", args: ["-y", "new"] });

    const content = JSON.parse(await readFile(filePath, "utf-8"));
    expect(content.mcpServers.existing).toEqual({ command: "old" });
    expect(content.mcpServers.new).toEqual({ command: "npx", args: ["-y", "new"] });
  });

  it("reads existing config", async () => {
    const filePath = join(testDir, "test.json");
    await writeFile(filePath, JSON.stringify({ key: "value" }, null, 2));

    const data = await readJsonConfig(filePath);
    expect(data.key).toBe("value");
  });

  it("returns empty object for missing file", async () => {
    const data = await readJsonConfig(join(testDir, "nonexistent.json"));
    expect(data).toEqual({});
  });

  it("removes server entry", async () => {
    const filePath = join(testDir, "test.json");
    await writeFile(filePath, JSON.stringify({
      mcpServers: { a: { command: "a" }, b: { command: "b" } },
    }, null, 2));

    const removed = await removeJsonConfig(filePath, "mcpServers", "a");
    expect(removed).toBe(true);

    const content = JSON.parse(await readFile(filePath, "utf-8"));
    expect(content.mcpServers.a).toBeUndefined();
    expect(content.mcpServers.b).toEqual({ command: "b" });
  });

  it("preserves JSONC comments", async () => {
    const filePath = join(testDir, "test.jsonc");
    await writeFile(filePath, `{
  // This is a comment
  "mcpServers": {
    "existing": { "command": "old" }
  }
}
`);

    await writeJsonConfig(filePath, "mcpServers", "new", { command: "new" });

    const raw = await readFile(filePath, "utf-8");
    expect(raw).toContain("// This is a comment");
    expect(raw).toContain('"new"');
  });
});

describe("YAML Format", () => {
  it("creates new config file", async () => {
    const filePath = join(testDir, "test.yaml");
    await writeYamlConfig(filePath, "extensions", "test", {
      name: "test",
      type: "stdio",
      cmd: "npx",
    });

    const data = await readYamlConfig(filePath);
    expect((data.extensions as Record<string, unknown>)?.test).toBeDefined();
  });

  it("returns empty object for missing file", async () => {
    const data = await readYamlConfig(join(testDir, "nonexistent.yaml"));
    expect(data).toEqual({});
  });
});
