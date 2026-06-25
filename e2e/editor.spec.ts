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
    // 実行ラベルは OS により ⌘/Ctrl が変わるため前方一致で判定する。
    const btn = page.locator("#run-stop-btn");
    await expect(btn).toHaveAttribute("title", "停止");

    await btn.click();
    await expect(btn).toHaveAttribute("title", /^実行/);

    await btn.click();
    await expect(btn).toHaveAttribute("title", "停止");
  });

  test("Ctrl+Enter re-runs the sketch without inserting a newline", async ({
    page,
  }) => {
    await openApp(page);

    // 一旦停止して Run 状態にしてから、Ctrl+Enter で再実行されることを確認する。
    const btn = page.locator("#run-stop-btn");
    await btn.click();
    await expect(btn).toHaveAttribute("title", /^実行/);

    await page.click(".monaco-editor .view-lines");
    const before = await editorText(page);
    await page.keyboard.press("Control+Enter");

    // 実行が走り（Stop 状態に戻る）、かつ Enter で改行が挿入されていないこと。
    await expect(btn).toHaveAttribute("title", "停止");
    expect(await editorText(page)).toBe(before);
  });

  test("editing after a run marks the run button as stale, re-run clears it", async ({
    page,
  }) => {
    await openApp(page);

    // 起動直後は初回実行済みでズレ無し
    const btn = page.locator("#run-stop-btn");
    await expect(btn).not.toHaveClass(/stale/);

    // コードを編集すると「未実行の変更あり」表示が点く
    await page.click(".monaco-editor .view-lines");
    await page.keyboard.type("// edit");
    await expect(btn).toHaveClass(/stale/);

    // 再実行で消える
    await page.keyboard.press("Control+Enter");
    await expect(btn).not.toHaveClass(/stale/);
  });

  test("switching tabs does not mark the run as stale", async ({ page }) => {
    await openApp(page);

    // setValue 由来の flush は実編集ではないため stale にならない（isFlush 判定）。
    const btn = page.locator("#run-stop-btn");
    await expect(btn).not.toHaveClass(/stale/);

    await tab(page, "index.html").click();
    await tab(page, "style.css").click();
    await tab(page, "sketch.js").click();

    await expect(btn).not.toHaveClass(/stale/);
  });

  test("stale dot does not shift the run button position", async ({ page }) => {
    await openApp(page);

    const centerY = (sel: string) =>
      page.locator(sel).evaluate((el) => {
        const r = el.getBoundingClientRect();
        return r.top + r.height / 2;
      });

    // 再生ボタンとプロジェクト名入力の縦中心が揃っている
    // （relative 化で .toolbar-btn の top:0.5rem が効く 8px ずれが無いこと）。
    const btnY = await centerY("#run-stop-btn");
    const inputY = await centerY("#project-name");
    expect(Math.abs(btnY - inputY)).toBeLessThan(2);

    // 差分ドット（::after は絶対配置）を出してもボタンの縦位置は変わらない。
    // タイプ由来のレイアウト変化を避けるため stale クラスを直接付与して検証する。
    await page
      .locator("#run-stop-btn")
      .evaluate((el) => el.classList.add("stale"));
    await expect(page.locator("#run-stop-btn")).toHaveClass(/stale/);
    expect(Math.abs((await centerY("#run-stop-btn")) - btnY)).toBeLessThan(0.5);
  });
});
