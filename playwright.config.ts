import { defineConfig, devices } from "@playwright/test";

// 開発環境用 E2E。重要: 設定の不透明度バグのように「本番ビルドのミニファイで
// だけ壊れる」回帰を捕まえるため、dev サーバではなく本番ビルド（build →
// preview）に対してテストする。
const PORT = 4789;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  // list に加え HTML レポートを常時生成（CI では失敗時にアーティファクト回収する）。
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
