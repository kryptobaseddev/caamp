import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/cli.ts", "src/index.ts"],
      reporter: ["text", "json-summary", "lcov"],
      thresholds: {
        lines: 90,
        functions: 95,
        statements: 90,
        branches: 80,
      },
    },
  },
});
