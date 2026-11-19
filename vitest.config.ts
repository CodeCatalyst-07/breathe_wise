import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**"],
      exclude: [
        "src/**/index.ts",
        "src/core/types.ts",
        "src/server/pipeline-types.ts",
        "src/app/**",
      ],
      thresholds: {
        statements: 85,
        lines: 85,
        "src/core/**": {
          statements: 90,
          lines: 90,
        },
        "src/server/**": {
          statements: 88,
          lines: 88,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./node_modules/server-only/empty.js"),
    },
  },
});
