import { test, expect } from "@playwright/test";

// 再実行トランジションの配線スモーク。
// ダブルバッファ（2 枚の iframe）であること、トランジションを選んで再実行しても
// 壊れない（#preview-frame が same-origin のまま残る）こと、即時切替が既定で
// あることを担保する。実際のアニメーション見た目は範囲外。

test.describe("preview re-run transition", () => {
  test("プレビューはダブルバッファ（preview-frame が 2 枚）", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForSelector(".monaco-editor .view-lines", {
      timeout: 20000,
    });
    await expect(page.locator(".preview-frame")).toHaveCount(2);
    // アクティブな 1 枚だけが id を持つ。
    await expect(page.locator("#preview-frame")).toHaveCount(1);
  });

  test("ディゾルブを選んで再実行しても preview-frame が生きている", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForSelector(".monaco-editor .view-lines", {
      timeout: 20000,
    });

    // 設定を開いてディゾルブを選ぶ（Transition は常時表示）。
    await page.click("#settings-btn");
    await page
      .locator(
        '.custom-select[data-key="previewTransition"] .custom-select-trigger'
      )
      .click();
    await page
      .locator(
        '.custom-select[data-key="previewTransition"] .custom-select-option[data-value="dissolve"]'
      )
      .click();

    // 再実行（トランジションが走る）。設定パネルは開いたままでも中央の
    // 再生ボタンはパネルに隠れないのでそのまま操作する。
    await page.locator("#run-stop-btn").click(); // stop
    await page.locator("#run-stop-btn").click(); // run → 遷移

    // 遷移完了後もアクティブフレームが same-origin で生きていること。
    await expect(page.locator("#preview-frame")).toHaveCount(1);
    const handle = await page.waitForSelector("#preview-frame");
    const frame = await handle.contentFrame();
    expect(frame).not.toBeNull();
  });

  test("ワイプを連続再実行してもアクティブフレームが消えない（黒くならない）", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForSelector(".monaco-editor .view-lines", {
      timeout: 20000,
    });

    // ワイプを選ぶ（短時間に）。
    await page.click("#settings-btn");
    await page
      .locator(
        '.custom-select[data-key="previewTransition"] .custom-select-trigger'
      )
      .click();
    await page
      .locator(
        '.custom-select[data-key="previewTransition"] .custom-select-option[data-value="wipe-right"]'
      )
      .click();

    // 2 回連続で再実行（バッファが両方向に入れ替わる）。
    for (let i = 0; i < 2; i++) {
      await page.locator("#run-stop-btn").click(); // stop
      await page.locator("#run-stop-btn").click(); // run → wipe
      await page.waitForTimeout(900); // 遷移完了を待つ
    }

    // 毎回後始末でアニメーションを cancel しているので、アクティブフレームは
    // clip で消えず可視・非クリップのまま。
    const active = page.locator("#preview-frame");
    await expect(active).toBeVisible();
    const clip = await active.evaluate((el) => getComputedStyle(el).clipPath);
    // forwards fill が残っていれば inset(... 100%) のように残るのでそれを弾く。
    expect(
      clip === "none" || clip === "" || /inset\(0px 0px 0px 0px\)/.test(clip)
    ).toBe(true);
  });
});
