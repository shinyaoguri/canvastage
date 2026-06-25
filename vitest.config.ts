import { defineConfig } from "vitest/config";

// ユニットテスト（純粋ロジック）。DOM 非依存なので node 環境で実行する。
// E2E（Playwright）は別系統（playwright.config.ts / test:e2e）。
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
