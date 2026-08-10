import { test, expect, type Page } from "@playwright/test";

// ドラフト自動保存（書き込み側）の検証。復元 UI はまだ無いので、
// IndexedDB に何が書かれた / 書かれなかったかを直接見る。

interface StoredDraft {
  id: string;
  projectName: string;
  currentFile: string;
  thumbnail: string | null;
  files: { html: string; css: string; js: string };
}

async function readDrafts(page: Page): Promise<StoredDraft[]> {
  return page.evaluate(
    () =>
      new Promise<StoredDraft[]>((resolve) => {
        // アプリが起動時にハートビートを打つので、この時点で DB は存在する。
        const request = indexedDB.open("canvastage-drafts");
        request.onerror = () => resolve([]);
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains("drafts")) {
            resolve([]);
            return;
          }
          const all = db
            .transaction("drafts", "readonly")
            .objectStore("drafts")
            .getAll();
          all.onerror = () => resolve([]);
          all.onsuccess = () => resolve(all.result as StoredDraft[]);
        };
      })
  );
}

async function openEditor(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForSelector(".monaco-editor .view-lines", { timeout: 20000 });
}

async function typeInEditor(page: Page, text: string): Promise<void> {
  await page.click(".monaco-editor .view-lines");
  await page.keyboard.type(text);
}

test.describe("draft auto-save", () => {
  // 起動しただけ・眺めただけのタブが復元候補を汚さないための中心的な仕様。
  // 初回実行が走ってもドラフトは生えない。
  test("編集しなければドラフトを作らない", async ({ page }) => {
    await openEditor(page);
    await page.waitForTimeout(3000);
    expect(await readDrafts(page)).toHaveLength(0);
  });

  test("タブを切り替えただけではドラフトを作らない", async ({ page }) => {
    await openEditor(page);
    await page.click("#file-tabs button:has-text('style.css')");
    await page.waitForTimeout(2000);
    expect(await readDrafts(page)).toHaveLength(0);
  });

  test("編集すると内容とプロジェクト名が保存される", async ({ page }) => {
    await openEditor(page);
    const projectName = await page.inputValue("#project-name");
    await typeInEditor(page, "// hello draft");

    await expect
      .poll(async () => (await readDrafts(page)).length, { timeout: 8000 })
      .toBe(1);

    const [draft] = await readDrafts(page);
    expect(draft.files.js).toContain("// hello draft");
    expect(draft.projectName).toBe(projectName);
    expect(draft.currentFile).toBe("js");
  });

  test("編集後に選択中のタブも保存される", async ({ page }) => {
    await openEditor(page);
    await typeInEditor(page, "// hello");
    await expect
      .poll(async () => (await readDrafts(page)).length, { timeout: 8000 })
      .toBe(1);

    await page.click("#file-tabs button:has-text('index.html')");
    await expect
      .poll(async () => (await readDrafts(page))[0]?.currentFile, {
        timeout: 8000,
      })
      .toBe("html");
  });

  // 新規プロジェクトは別のスケッチなので、前のドラフトを上書きせず別レコードになる。
  test("新規プロジェクトにすると別のドラフトになる", async ({ page }) => {
    await openEditor(page);
    await typeInEditor(page, "// first");
    await expect
      .poll(async () => (await readDrafts(page)).length, { timeout: 8000 })
      .toBe(1);
    const firstId = (await readDrafts(page))[0].id;

    await page.click("#new-project-btn");
    await typeInEditor(page, "// second");
    await expect
      .poll(async () => (await readDrafts(page)).length, { timeout: 8000 })
      .toBe(2);

    const drafts = await readDrafts(page);
    const second = drafts.find((d) => d.id !== firstId);
    expect(second?.files.js).toContain("// second");
    expect(drafts.find((d) => d.id === firstId)?.files.js).toContain(
      "// first"
    );
  });

  // 復元候補を名前だけで見分けるのは難しいので、実行中の canvas を撮って残す。
  test("実行後のサムネイルがドラフトに残る", async ({ page }) => {
    await openEditor(page);
    // 初回実行のキャプチャ（実行の 1.2 秒後）が済んでから編集する。
    await page.waitForTimeout(2500);
    await typeInEditor(page, "// with thumbnail");

    await expect
      .poll(async () => (await readDrafts(page))[0]?.thumbnail?.slice(0, 11), {
        timeout: 8000,
      })
      .toBe("data:image/");
  });

  // 同じタブを 2 つ開いても、互いのドラフトを奪い合わない。
  test("別タブは自分のドラフトを持つ", async ({ page, context }) => {
    await openEditor(page);
    await typeInEditor(page, "// tab one");
    await expect
      .poll(async () => (await readDrafts(page)).length, { timeout: 8000 })
      .toBe(1);

    const second = await context.newPage();
    await openEditor(second);
    await typeInEditor(second, "// tab two");
    await expect
      .poll(async () => (await readDrafts(second)).length, { timeout: 8000 })
      .toBe(2);

    const contents = (await readDrafts(second)).map((d) => d.files.js);
    expect(contents.some((js) => js.includes("// tab one"))).toBe(true);
    expect(contents.some((js) => js.includes("// tab two"))).toBe(true);
    await second.close();
  });
});
