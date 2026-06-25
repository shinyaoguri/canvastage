import { test, expect, type Page } from "@playwright/test";

// 設定パネルの各項目が、本番ビルドで実際にエディタへ反映されるかを検証する。
// 過去に「rgba() の中に var() を入れた CSS がミニファイで削除され、行番号・
// 選択範囲・サジェストの不透明度設定がまったく効かない」回帰があった。

async function openSettings(page: Page) {
  await page.goto("/");
  await page.waitForSelector(".monaco-editor .line-numbers", {
    timeout: 20000,
  });
  await page.click("#settings-btn");
  await page.waitForSelector("#settings-panel.open");
}

// レンジ/テキスト/カラー入力を変更し input を発火
async function setInput(page: Page, key: string, value: string | number) {
  const ok = await page.evaluate(
    ({ key, value }) => {
      const el = document.querySelector<HTMLInputElement>(
        `#settings-panel input[data-key="${key}"]`
      );
      if (!el) return false;
      el.value = String(value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    },
    { key, value }
  );
  expect(ok, `control input[data-key="${key}"] should exist`).toBe(true);
}

// カスタムセレクトのオプションを選択
async function selectOption(page: Page, key: string, value: string) {
  const ok = await page.evaluate(
    ({ key, value }) => {
      const opt = document.querySelector(
        `#settings-panel .custom-select[data-key="${key}"] .custom-select-option[data-value="${value}"]`
      );
      if (!opt) return false;
      opt.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return true;
    },
    { key, value }
  );
  expect(ok, `select option ${key}=${value} should exist`).toBe(true);
}

function computed(page: Page, selector: string, prop: string) {
  return page.evaluate(
    ({ selector, prop }) => {
      const el = document.querySelector(selector);
      return el ? getComputedStyle(el).getPropertyValue(prop).trim() : "NO_EL";
    },
    { selector, prop }
  );
}

test.describe("settings reflect into the editor (production build)", () => {
  test("line number opacity changes line-number color", async ({ page }) => {
    await openSettings(page);
    const sel = ".monaco-editor .margin-view-overlays .line-numbers";
    const before = await computed(page, sel, "color");
    await setInput(page, "lineNumberOpacity", 1);
    const after = await computed(page, sel, "color");
    expect(after).not.toBe(before);
    expect(after).not.toBe("NO_EL");
  });

  test("selection opacity changes selection background", async ({ page }) => {
    await openSettings(page);
    await page.click(".monaco-editor .view-lines");
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Meta+a");
    const sel = ".monaco-editor .selected-text";
    await page.waitForSelector(sel, { timeout: 5000 });
    const before = await computed(page, sel, "background-color");
    await setInput(page, "selectionOpacity", 0.5);
    const after = await computed(page, sel, "background-color");
    expect(after).not.toBe(before);
  });

  test("suggest opacities change the suggest widget", async ({ page }) => {
    await openSettings(page);
    await page.click(".monaco-editor .view-lines");
    await page.keyboard.press("Control+End");
    await page.keyboard.type("\nconsole.");
    await page.keyboard.press("Control+Space");
    await page.waitForSelector(".monaco-editor .suggest-widget.visible", {
      timeout: 8000,
    });

    const widget = ".monaco-editor .suggest-widget";
    const bgBefore = await computed(page, widget, "background-color");
    await setInput(page, "suggestBackgroundOpacity", 1);
    expect(await computed(page, widget, "background-color")).not.toBe(bgBefore);

    const row = ".monaco-editor .suggest-widget .monaco-list-row:not(.focused)";
    await page.waitForSelector(row, { timeout: 5000 });
    const colorBefore = await computed(page, row, "color");
    await setInput(page, "suggestTextOpacity", 0.1);
    expect(await computed(page, row, "color")).not.toBe(colorBefore);
  });

  test("text opacity changes code text opacity", async ({ page }) => {
    await openSettings(page);
    const sel = ".monaco-editor .view-line span";
    const before = await computed(page, sel, "opacity");
    await setInput(page, "textOpacity", 0.2);
    expect(await computed(page, sel, "opacity")).not.toBe(before);
  });

  test("cursor width changes the caret width", async ({ page }) => {
    await openSettings(page);
    const sel = ".monaco-editor .cursor";
    const before = await computed(page, sel, "width");
    await setInput(page, "cursorWidth", 4);
    expect(await computed(page, sel, "width")).not.toBe(before);
  });

  test("editor padding moves the editor container", async ({ page }) => {
    await openSettings(page);
    const sel = "body > .monaco-editor";
    const before = await computed(page, sel, "left");
    await setInput(page, "editorPadding", 64);
    expect(await computed(page, sel, "left")).not.toBe(before);
  });

  test("theme change recolors tokens", async ({ page }) => {
    await openSettings(page);
    const sel = ".monaco-editor .view-line";
    const before = await computed(page, sel, "color");
    await selectOption(page, "editorTheme", "monokai");
    await expect
      .poll(() => computed(page, sel, "color"), { timeout: 4000 })
      .not.toBe(before);
  });

  test("font size slider allows up to 48 and applies", async ({ page }) => {
    await openSettings(page);
    // スライダーの上限が 48 に拡張されている
    expect(
      await page.getAttribute(
        '#settings-panel input[data-key="fontSize"]',
        "max"
      )
    ).toBe("48");

    // 48 を指定するとエディタのフォントサイズに反映される
    const sel = ".monaco-editor .view-line";
    await setInput(page, "fontSize", 48);
    await expect
      .poll(() => computed(page, sel, "font-size"), { timeout: 4000 })
      .toBe("48px");
  });
});
