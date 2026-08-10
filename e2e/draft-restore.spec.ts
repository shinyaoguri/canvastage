import { test, expect, type Page } from "@playwright/test";

// 起動時のドラフト復元。
// IndexedDB への仕込みは「アプリに DB を作らせてから書き、reload する」方式。
// addInitScript でスキーマを自前に再現すると、実装とずれた瞬間に嘘のテストになる。

const HOUR = 60 * 60 * 1000;

interface SeedDraft {
  id: string;
  projectName: string;
  updatedAt: number;
  files: { html: string; css: string; js: string };
  [key: string]: unknown;
}

function makeDraft(over: Partial<SeedDraft> = {}): SeedDraft {
  const now = Date.now();
  return {
    id: "seed-1",
    schemaVersion: 1,
    files: {
      html: "<html><body></body></html>",
      css: "body { margin: 0 }",
      js: "// RESTORED_MARKER",
    },
    projectName: "restored-sketch",
    currentFile: "js",
    gistId: null,
    savedProjectName: null,
    gistOwnerLogin: null,
    gistDirty: false,
    openProcessingSketchId: null,
    openProcessingOwner: null,
    openProcessingDirty: false,
    createdAt: now,
    updatedAt: now,
    ownerTabId: "seed-tab",
    ...over,
  };
}

// 復元の選択はエディタ生成より前に済むので、エディタが出た時点で
// 「モーダルは出なかった」と言い切れる（待ち時間を挟む必要がない）。
async function openEditor(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForSelector(".monaco-editor .view-lines", { timeout: 20000 });
}

async function openAndExpectModal(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForSelector("#draft-restore-overlay.open", { timeout: 20000 });
}

async function seedDraft(page: Page, draft: SeedDraft): Promise<void> {
  await page.evaluate(
    (record) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("canvastage-drafts");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const tx = request.result.transaction("drafts", "readwrite");
          tx.objectStore("drafts").put(record, record.id as string);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
    draft as Record<string, unknown>
  );
}

async function countDrafts(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const request = indexedDB.open("canvastage-drafts");
        request.onerror = () => resolve(-1);
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains("drafts")) {
            resolve(0);
            return;
          }
          const all = db
            .transaction("drafts", "readonly")
            .objectStore("drafts")
            .getAllKeys();
          all.onerror = () => resolve(-1);
          all.onsuccess = () => resolve(all.result.length);
        };
      })
  );
}

/** ドラフトを仕込んでから開き直す（復元モーダルが出るまで待つ）。 */
async function reopenWith(page: Page, draft: SeedDraft): Promise<void> {
  // 1 回目はアプリに DB とストアを作らせるためだけに開く。
  await openEditor(page);
  await seedDraft(page, draft);
  await openAndExpectModal(page);
}

const overlay = "#draft-restore-overlay";

test.describe("draft restore", () => {
  test("候補が無ければモーダルを出さない", async ({ page }) => {
    await openEditor(page);
    await expect(page.locator(overlay)).toHaveCount(0);
  });

  test("選ぶと内容・プロジェクト名・タブが戻る", async ({ page }) => {
    await reopenWith(
      page,
      makeDraft({ currentFile: "css", projectName: "my-old-sketch" })
    );

    await expect(page.locator(".draft-item")).toHaveText(/my-old-sketch/);

    await page.click(".draft-item");
    await expect(page.locator(overlay)).toHaveCount(0);
    await expect(page.locator("#project-name")).toHaveValue("my-old-sketch");
    // currentFile が css なので、css タブが選択された状態で開く。
    await expect(
      page.locator("#file-tabs button:has-text('style.css')")
    ).toHaveClass(/active/);
    await expect(page.locator(".monaco-editor .view-lines")).toContainText(
      "margin"
    );
  });

  test("新規で始めるとドラフトは残ったまま別の内容で開く", async ({ page }) => {
    await reopenWith(page, makeDraft());

    await page.click("#draft-restore-new");
    await expect(page.locator(overlay)).toHaveCount(0);
    await expect(page.locator("#project-name")).not.toHaveValue(
      "restored-sketch"
    );

    // 選ばなかっただけで捨ててはいない。開き直せばまた候補に出る。
    await openAndExpectModal(page);
  });

  test("48時間より古いドラフトは候補に出ず、掃除される", async ({ page }) => {
    await openEditor(page);
    await seedDraft(page, makeDraft({ updatedAt: Date.now() - 49 * HOUR }));
    await openEditor(page);

    await expect(page.locator(overlay)).toHaveCount(0);
    await expect.poll(() => countDrafts(page), { timeout: 5000 }).toBe(0);
  });

  // プロジェクト名はユーザー入力なので、一覧に流すときに HTML として解釈させない。
  test("プロジェクト名を HTML として解釈しない", async ({ page }) => {
    const evil = '<img src=x onerror="window.__pwned = true">';
    await reopenWith(page, makeDraft({ projectName: evil }));

    await expect(page.locator(`${overlay} img`)).toHaveCount(0);
    await expect(page.locator(".draft-item")).toContainText("<img");
    expect(await page.evaluate(() => "__pwned" in window)).toBe(false);
  });

  test("サムネイルがあれば一覧に見た目を出す", async ({ page }) => {
    // 1x1 の透明 PNG。中身は問わず、画像として描画されることだけを見る。
    const pixel =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    await reopenWith(page, makeDraft({ thumbnail: pixel }));

    const img = page.locator(".draft-item-thumb img");
    await expect(img).toHaveCount(1);
    await expect(img).toHaveAttribute("src", pixel);
  });

  // canvas を持たない / まだ実行していないスケッチはコードの抜粋で代用する。
  test("サムネイルが無ければコードの抜粋を出す", async ({ page }) => {
    await reopenWith(
      page,
      makeDraft({
        thumbnail: null,
        files: {
          html: "",
          css: "",
          js: "// leading comment\n\ncircle(50, 50, 20);",
        },
      })
    );

    const code = page.locator(".draft-item-thumb-code");
    await expect(code).toHaveCount(1);
    // 空行と行コメントだけの行は抜粋から落とす。
    await expect(code).toContainText("circle(50, 50, 20);");
    await expect(code).not.toContainText("leading comment");
  });

  test("他のタブが開いているドラフトは候補に出さない", async ({
    page,
    context,
  }) => {
    // 1 枚目で実際に編集してドラフトを作らせる（このタブが握った状態）。
    await openEditor(page);
    await page.click(".monaco-editor .view-lines");
    await page.keyboard.type("// held by tab one");
    await expect.poll(() => countDrafts(page), { timeout: 8000 }).toBe(1);

    // 2 枚目からは「他のタブが開いている」ので候補に出ない。
    const second = await context.newPage();
    await openEditor(second);
    await expect(second.locator(overlay)).toHaveCount(0);
    await second.close();

    // 1 枚目を閉じるとセッションが解放され、候補に出るようになる。
    await page.close();
    const third = await context.newPage();
    await openAndExpectModal(third);
    await expect(third.locator(".draft-item")).toHaveCount(1);
    await third.close();
  });
});
