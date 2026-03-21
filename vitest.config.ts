import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/cli.ts",
        "src/index.ts",
        "src/types.ts",
        "src/core/registry/types.ts",
        "src/core/registry/spawn-adapter.ts",
        "src/core/marketplace/types.ts",
        "src/core/skills/skill-library.ts",
        "src/core/skills/integrity.ts",
      ],
      reporter: ["text", "json-summary", "lcov"],
      thresholds: {
        lines: 95,
        functions: 97,
        statements: 95,
        branches: 89,
      },
    },
  },
});
