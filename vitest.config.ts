import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Standalone Vitest config so unit tests don't pull in the full TanStack/
 * Cloudflare Vite plugin pipeline. Coverage is wired here for CI.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["src/routes/__tests__/**/*.e2e.test.ts", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary", "lcov"],
      reportsDirectory: "./coverage",
      include: [
        "src/lib/reputation.ts",
        "src/components/WorkerReputationBadge.tsx",
        "src/lib/proposal-status.ts",
        "src/lib/document-dates.ts",
        "src/lib/messages-grouping.ts",
        "src/lib/password-validation.ts",
        "src/lib/date-mask.ts",
      ],
    },
  },
});