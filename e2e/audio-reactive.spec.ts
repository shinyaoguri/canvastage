import { test, expect } from "@playwright/test";

// 音声ビート可視化の配線スモーク。
// playwright.config の fake-media フラグでマイク取得が無人で成立するので、
// 設定パネルのトグル ON → エンジン開始 → オーバーレイがアクティブ化、までを担保する。
// （実際のビート/フラッシュは音量依存で不安定なので、状態遷移のみ検証する。）

test.describe("audio reactive beat visualizer", () => {
  test("既定は OFF（オーバーレイは非アクティブ）", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".monaco-editor .view-lines", {
      timeout: 20000,
    });

    const overlay = page.locator("#beat-overlay");
    await expect(overlay).toHaveCount(1);
    await expect(overlay).not.toHaveClass(/beat-frame-flash/);
  });

  test("設定からマイクを ON にするとオーバーレイがアクティブ化する", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForSelector(".monaco-editor .view-lines", {
      timeout: 20000,
    });

    await page.click("#settings-btn");
    // フラッシュ中はオーバーレイで要素が不安定になり .check() が二度押しに
    // なりうるため、単発 click で操作して結果状態を検証する。
    await page.locator("#audio-enable").click();

    // 権限取得→開始でオーバーレイにパターンクラスが付く。
    await expect(page.locator("#beat-overlay")).toHaveClass(
      /beat-frame-flash/,
      { timeout: 10000 }
    );
    await expect(page.locator(".audio-status")).toHaveText(/オン/);
    await expect(page.locator("#audio-enable")).toBeChecked();

    // OFF に戻すとアクティブ解除。
    await page.locator("#audio-enable").click();
    await expect(page.locator("#beat-overlay")).not.toHaveClass(
      /beat-frame-flash/
    );
    await expect(page.locator(".audio-status")).toHaveText(/オフ/);
  });
});
