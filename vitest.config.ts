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
        "src/core/marketplace/types.ts",
        "src/core/skills/skill-library.ts",
      ],
      reporter: ["text", "json-summary", "lcov"],
      thresholds: {
        lines: 99,
        functions: 100,
        statements: 99,
        branches: 94,
      },
    },
  },
});
