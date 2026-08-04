import { test, expect, type Page } from "@playwright/test";

// Monaco の Web Worker が実際に起動しているかを担保する回帰テスト。
// monaco-editor 0.56.0 で ESM のエントリポイントが再編され、従来の
// `monaco-editor/esm/vs/...` という深いパスは exports 制約で解決できなくなった
// （dependabot の一括更新 PR #71 でビルドが落ちた）。
// worker の import 先を間違えるとビルドは通っても言語機能だけが黙って死ぬため、
// 「TypeScript worker 由来の診断が出ること」を CI で確認する。

async function openApp(page: Page) {
  await page.goto("/");
  await page.waitForSelector(".monaco-editor .view-lines", { timeout: 20000 });
}

test.describe("monaco language workers", () => {
  test("TypeScript worker が起動し sketch.js に診断を出す", async ({
    page,
  }) => {
    const workerErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && /worker/i.test(msg.text())) {
        workerErrors.push(msg.text());
      }
    });

    await openApp(page);

    // 構文エラーを注入する。TS worker が動いていればエラーマーカー（波線）が付く。
    await page.click(".monaco-editor .view-lines");
    await page.keyboard.press("Control+End");
    await page.keyboard.type("\nfunction (");

    await expect(
      page.locator(".monaco-editor .squiggly-error").first()
    ).toBeVisible({ timeout: 15000 });

    expect(workerErrors, "worker のロードエラーが出ていない").toEqual([]);
  });

  test("CSS worker が起動し style.css に診断を出す", async ({ page }) => {
    await openApp(page);

    await page.locator("#file-tabs button", { hasText: "style.css" }).click();
    await page.click(".monaco-editor .view-lines");
    await page.keyboard.press("Control+End");
    await page.keyboard.type("\nbody { color: }");

    await expect(
      page.locator(".monaco-editor .squiggly-error").first()
    ).toBeVisible({ timeout: 15000 });
  });
});
