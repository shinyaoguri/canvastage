import { test, expect } from "@playwright/test";

// プレビュー iframe の same-origin 設計を守る回帰テスト。
// allow-same-origin を外して不透明オリジンにすると getUserMedia が権限を
// 取得できず webcam / ML サンプルが壊れる（commit 88374f5 で一度起きた回帰）。
// CLAUDE.md の "The preview iframe runs SAME-ORIGIN on purpose" を CI で担保する。

test.describe("preview iframe same-origin guarantee", () => {
  test("sandbox に allow-same-origin/allow-scripts を持つ", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForSelector(".monaco-editor .view-lines", {
      timeout: 20000,
    });

    const sandbox = await page
      .locator("#preview-frame")
      .getAttribute("sandbox");
    expect(sandbox).toContain("allow-same-origin");
    expect(sandbox).toContain("allow-scripts");
  });

  test("プレビューは same-origin で getUserMedia が成立する", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForSelector(".monaco-editor .view-lines", {
      timeout: 20000,
    });

    // 初回実行で srcdoc がロードされるまで待つ。
    const handle = await page.waitForSelector("#preview-frame");
    const frame = await handle.contentFrame();
    expect(
      frame,
      "プレビュー iframe が取得できる（=same-origin）"
    ).not.toBeNull();

    await frame!.waitForLoadState();

    // 不透明オリジンだと getUserMedia は権限を取れず reject する。
    // フェイクメディア有効化済みなので same-origin なら "ok" になる。
    const result = await frame!.evaluate(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        stream.getTracks().forEach((t) => t.stop());
        return "ok";
      } catch (e) {
        return String(e);
      }
    });
    expect(result).toBe("ok");
  });
});
