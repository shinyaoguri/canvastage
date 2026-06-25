import { test, expect } from "@playwright/test";

// Gist 取り込みモーダルの UI 配線スモーク（ネットワークには行かない）。
// 実際の取り込み（GitHub API 取得）はネットワーク依存なので E2E では検証せず、
// ボタン→モーダル表示→入力バリデーション→閉じる、の配線だけを担保する。

test.describe("gist import modal", () => {
  test("opens, validates empty input, and closes", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".monaco-editor .view-lines", {
      timeout: 20000,
    });

    // ボタンでモーダルが開く
    await page.click("#import-btn");
    const overlay = page.locator("#import-modal-overlay");
    await expect(overlay).toHaveClass(/open/);
    await expect(page.locator("#import-url-input")).toBeVisible();

    // 不正（空）入力ではバリデーションエラーになり、ネットワークには行かない
    await page.click("#import-run");
    await expect(page.locator("#import-status")).toHaveText(/入力してください/);

    // 閉じるボタンで閉じる
    await page.click("#import-modal-overlay .op-modal-close");
    await expect(overlay).not.toHaveClass(/open/);
  });
});
