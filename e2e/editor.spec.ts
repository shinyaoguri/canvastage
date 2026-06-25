import { test, expect, type Page } from "@playwright/test";

// エディタ周辺の基本操作（タブ切替・Run/Stop）の回帰テスト。
// settings.spec.ts は設定反映のみを見ており、ツールバーやタブの配線は
// 未カバーだった。init() の構造リファクタ(B4)の安全網としてここで担保する。

async function openApp(page: Page) {
  await page.goto("/");
  await page.waitForSelector(".monaco-editor .view-lines", { timeout: 20000 });
}

function tab(page: Page, name: string) {
  return page.locator("#file-tabs button", { hasText: name });
}

function editorText(page: Page) {
  return page.locator(".monaco-editor .view-lines").first().innerText();
}

test.describe("editor tabs & run controls", () => {
  test("switching file tabs swaps editor content and active state", async ({
    page,
  }) => {
    await openApp(page);

    // 初期は sketch.js がアクティブ
    await expect(tab(page, "sketch.js")).toHaveClass(/active/);
    const jsText = await editorText(page);

    // index.html へ切替 → アクティブが移り、HTML が表示される
    await tab(page, "index.html").click();
    await expect(tab(page, "index.html")).toHaveClass(/active/);
    await expect(tab(page, "sketch.js")).not.toHaveClass(/active/);
    await expect.poll(() => editorText(page)).toContain("DOCTYPE");
    expect(await editorText(page)).not.toBe(jsText);

    // style.css へ切替 → CSS（常に DEFAULT_CSS）が表示される
    await tab(page, "style.css").click();
    await expect(tab(page, "style.css")).toHaveClass(/active/);
    await expect.poll(() => editorText(page)).toContain("{");

    // sketch.js に戻ると元の内容に復帰する
    await tab(page, "sketch.js").click();
    await expect(tab(page, "sketch.js")).toHaveClass(/active/);
    await expect.poll(() => editorText(page)).toBe(jsText);
  });

  test("run/stop button toggles its state", async ({ page }) => {
    await openApp(page);

    // init で初回実行されるため、起動直後は Stop 状態
    const btn = page.locator("#run-stop-btn");
    await expect(btn).toHaveAttribute("title", "Stop");

    await btn.click();
    await expect(btn).toHaveAttribute("title", "Run (⌘+Enter)");

    await btn.click();
    await expect(btn).toHaveAttribute("title", "Stop");
  });
});
