import { test, expect, type Frame, type Page } from "@playwright/test";

// 分割表示 (エディタ左・プレビュー右) の回帰テスト (#108)。
//
// 重ね表示の入力ブリッジは親で受けた入力を iframe へ転送し、rAF フックで
// mouseX / key / windowWidth を毎フレーム親の値で上書きする。分割表示でそれが
// 残ると、キャンバスが右ペインからはみ出し (windowWidth が親の幅になる)、
// エディタ上のマウス移動やタイピングがスケッチへ漏れる。分割表示ではこの転送を
// 止め、スケッチには iframe 内の通常のイベントを使わせる — それをここで見る。
//
// p5.js は CDN から読まず、ブリッジが触るグローバルだけを持つ偽のスケッチで
// 検証する (preview-input-coords.spec.ts と同じ方針)。p5.js と同じく iframe 自身の
// resize で windowWidth を更新する。

const SKETCH = {
  html: '<html><head><link rel="stylesheet" href="style.css"></head><body><script src="sketch.js"></script></body></html>',
  css: "body { margin: 0; overflow: hidden }",
  js: [
    "var __splitViewSketch = true;",
    "var windowWidth = window.innerWidth, windowHeight = window.innerHeight;",
    "window.addEventListener('resize', function () { windowWidth = window.innerWidth; windowHeight = window.innerHeight; });",
    "var mouseX = 0, mouseY = 0, pmouseX = 0, pmouseY = 0, touches = [];",
    "var key = '', keyCode = 0, keyIsPressed = false;",
    "(function loop() { requestAnimationFrame(loop); })();",
  ].join("\n"),
};

const VIEWPORT_WIDTH = 1280;

async function waitForEditor(page: Page) {
  await page.waitForSelector(".monaco-editor .view-lines", { timeout: 20000 });
}

// IndexedDB に保存済みの設定値を読む（settings.spec.ts と同じ）。
// saveSettings は fire-and-forget なので、reload の前にこれで永続化を待つ。
async function readPersistedSetting(page: Page, key: string): Promise<unknown> {
  return page.evaluate(
    (settingKey) =>
      new Promise<unknown>((resolve) => {
        const request = indexedDB.open("canvastage-db");
        request.onerror = () => resolve(null);
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains("settings")) {
            resolve(null);
            return;
          }
          const get = db
            .transaction("settings", "readonly")
            .objectStore("settings")
            .get("editor-settings");
          get.onerror = () => resolve(null);
          get.onsuccess = () =>
            resolve(
              (get.result as Record<string, unknown> | undefined)?.[
                settingKey
              ] ?? null
            );
        };
      }),
    key
  );
}

// 偽のスケッチを下書きとして仕込み、開き直して復元モーダルから走らせる
// (e2e/draft-restore.spec.ts と同じ仕込み方)。呼ぶ前にアプリを一度開いておくこと。
async function restoreFakeSketch(page: Page): Promise<Frame> {
  const now = Date.now();
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
    {
      id: "split-view",
      schemaVersion: 1,
      files: SKETCH,
      projectName: "split-view",
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
    } as Record<string, unknown>
  );

  await page.goto("/");
  await page.waitForSelector("#draft-restore-overlay.open", { timeout: 20000 });
  await page.click(".draft-item");
  await expect(page.locator("#draft-restore-overlay")).toHaveCount(0);
  await waitForEditor(page);

  await page.waitForFunction(() => {
    const iframe = document.querySelector<HTMLIFrameElement>("#preview-frame");
    return !!(
      iframe?.contentWindow as unknown as { __splitViewSketch?: boolean } | null
    )?.__splitViewSketch;
  });
  const frame = await (
    await page.waitForSelector("#preview-frame")
  ).contentFrame();
  expect(frame).not.toBeNull();
  return frame!;
}

function layout(page: Page) {
  return page.evaluate(() => document.documentElement.dataset.layout);
}

function frameRect(page: Page) {
  return page.evaluate(() => {
    const r = document.querySelector("#preview-frame")!.getBoundingClientRect();
    return { left: r.left, width: r.width };
  });
}

// エディタが実際に描いている右端。外側の箱ではなく Monaco 内部の overflow-guard を
// 測る — 箱だけ CSS で縮めても内部が広いままなら、そこがプレビューにかぶる。
function editorRight(page: Page) {
  return page.evaluate(
    () =>
      document
        .querySelector("#editor-container .overflow-guard")!
        .getBoundingClientRect().right
  );
}

function topElementAt(page: Page, x: number, y: number) {
  return page.evaluate(
    ([px, py]) => {
      const el = document.elementFromPoint(px, py);
      return el ? `${el.tagName}#${el.id}` : null;
    },
    [x, y]
  );
}

function readSketch(frame: Frame) {
  return frame.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    return {
      windowWidth: w.windowWidth as number,
      innerWidth: window.innerWidth,
      mouseX: w.mouseX as number,
      key: w.key as string,
    };
  });
}

// 親の document にマウス移動を送る（重ね表示ならブリッジが転送する経路）。
async function moveMouseOnParent(page: Page, x: number, y: number) {
  await page.evaluate(
    ([clientX, clientY]) =>
      document.dispatchEvent(
        new MouseEvent("mousemove", { clientX, clientY, bubbles: true })
      ),
    [x, y]
  );
}

// 「届かないこと」を確かめるために、メッセージとフレームを数回やり過ごす。
async function settle(frame: Frame) {
  await frame.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let n = 0;
        const tick = () => (++n >= 5 ? resolve() : requestAnimationFrame(tick));
        setTimeout(tick, 100);
      })
  );
}

async function enableSplitFromSettings(page: Page) {
  await page.click("#settings-btn");
  await page.waitForSelector("#settings-panel.open");
  await page.check('#settings-panel input[data-key="splitView"]');
  await page.click("#settings-panel .settings-close");
}

test.describe("split view", () => {
  test("既定は重ね表示で、設定のスイッチで左右分割になり、再読み込み後も保たれる", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForEditor(page);

    expect(await layout(page)).toBe("overlay");
    expect(await frameRect(page)).toEqual({ left: 0, width: VIEWPORT_WIDTH });

    await enableSplitFromSettings(page);
    expect(await layout(page)).toBe("split");
    await expect
      .poll(() => frameRect(page))
      .toEqual({ left: VIEWPORT_WIDTH / 2, width: VIEWPORT_WIDTH / 2 });
    // エディタは左ペインに収まり、プレビューと重ならない。
    await expect
      .poll(() => editorRight(page))
      .toBeLessThanOrEqual(VIEWPORT_WIDTH / 2);
    await expect(page.locator("#split-divider")).toBeVisible();
    // プレビュー側をどこを指しても iframe に当たる (エディタの内部要素がかぶらない)。
    // Monaco が自分の箱より広い寸法でレイアウトすると、上端の行のあたりで
    // view-lines がクリックを奪う。
    for (const y of [60, 200, 600]) {
      await expect
        .poll(() => topElementAt(page, VIEWPORT_WIDTH * 0.75, y))
        .toBe("IFRAME#preview-frame");
    }

    await expect
      .poll(() => readPersistedSetting(page, "splitView"), { timeout: 5000 })
      .toBe(true);
    await page.reload();
    await waitForEditor(page);
    expect(await layout(page)).toBe("split");
    expect(await frameRect(page)).toEqual({
      left: VIEWPORT_WIDTH / 2,
      width: VIEWPORT_WIDTH / 2,
    });
  });

  test("分割表示で起動したスケッチは親の幅や入力で上書きされない", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForEditor(page);
    await enableSplitFromSettings(page);
    await expect
      .poll(() => readPersistedSetting(page, "splitView"), { timeout: 5000 })
      .toBe(true);

    const frame = await restoreFakeSketch(page);
    expect(await layout(page)).toBe("split");
    await settle(frame);

    // windowWidth はペインの幅のまま (親の 1280 にならない)。
    const before = await readSketch(frame);
    expect(before.innerWidth).toBe(VIEWPORT_WIDTH / 2);
    expect(before.windowWidth).toBe(VIEWPORT_WIDTH / 2);

    // エディタ上のマウス移動・タイピングはスケッチへ漏れない。
    await moveMouseOnParent(page, 100, 200);
    await page.click(".monaco-editor .view-lines");
    await page.keyboard.type("q");
    await settle(frame);
    const after = await readSketch(frame);
    expect(after.mouseX).toBe(0);
    expect(after.key).toBe("");
    expect(after.windowWidth).toBe(VIEWPORT_WIDTH / 2);
  });

  test("⌘/Ctrl + \\ で実行中のまま切り替わり、入力転送も追従する", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForEditor(page);
    const frame = await restoreFakeSketch(page);
    expect(await layout(page)).toBe("overlay");

    // 重ね表示: 転送が効いている (前提の確認)。
    await moveMouseOnParent(page, 300, 200);
    await expect.poll(() => readSketch(frame).then((s) => s.mouseX)).toBe(300);

    await page.keyboard.press("Control+Backslash");
    expect(await layout(page)).toBe("split");
    await expect(
      page.locator('#settings-panel input[data-key="splitView"]')
    ).toBeChecked();

    // 分割表示: windowWidth はペインの幅になり、親の入力は届かない。
    await expect
      .poll(() => readSketch(frame).then((s) => s.windowWidth))
      .toBe(VIEWPORT_WIDTH / 2);
    await moveMouseOnParent(page, 10, 20);
    await settle(frame);
    expect((await readSketch(frame)).mouseX).toBe(300);

    // 重ね表示へ戻すと、windowWidth は全幅へ戻り、転送も再開する。
    await page.keyboard.press("Control+Backslash");
    expect(await layout(page)).toBe("overlay");
    await expect
      .poll(() => readSketch(frame).then((s) => s.windowWidth))
      .toBe(VIEWPORT_WIDTH);
    await moveMouseOnParent(page, 50, 60);
    await expect.poll(() => readSketch(frame).then((s) => s.mouseX)).toBe(50);
  });

  test("プレビューにフォーカスがあってもショートカットで戻せる", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForEditor(page);
    await page.keyboard.press("Control+Backslash");
    expect(await layout(page)).toBe("split");

    // キャンバス側をクリックすると、キー入力は iframe に入る。ここで iframe に
    // フォーカスが移っていないと、親のショートカットで切り替わってしまい
    // 中継の経路を検証できない。
    await page.mouse.click(VIEWPORT_WIDTH * 0.75, 400);
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.id))
      .toBe("preview-frame");
    await page.keyboard.press("Control+Backslash");
    await expect.poll(() => layout(page)).toBe("overlay");
  });

  test("仕切りをドラッグすると比率が変わり、離したときに保存される", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForEditor(page);
    await page.keyboard.press("Control+Backslash");

    const divider = await page.locator("#split-divider").boundingBox();
    expect(divider).not.toBeNull();
    const y = divider!.y + divider!.height / 2;
    await page.mouse.move(divider!.x + divider!.width / 2, y);
    await page.mouse.down();
    // iframe の上を通っても見失わないこと。
    await page.mouse.move(VIEWPORT_WIDTH * 0.7, y, { steps: 5 });
    await page.mouse.move(400, y, { steps: 10 });
    await page.mouse.up();

    await expect
      .poll(() => frameRect(page))
      .toEqual({
        left: 400,
        width: VIEWPORT_WIDTH - 400,
      });
    await expect
      .poll(() => readPersistedSetting(page, "splitRatio"), { timeout: 5000 })
      .toBeCloseTo(400 / VIEWPORT_WIDTH, 5);
    await expect.poll(() => editorRight(page)).toBeLessThanOrEqual(400);
  });

  test.describe("狭い画面", () => {
    test.use({ viewport: { width: 390, height: 800 } });

    test("上にプレビュー・下にエディタを積み、仕切りは出さない", async ({
      page,
    }) => {
      await page.goto("/");
      await waitForEditor(page);
      await page.keyboard.press("Control+Backslash");
      expect(await layout(page)).toBe("split");

      const rects = await page.evaluate(() => {
        const f = document
          .querySelector("#preview-frame")!
          .getBoundingClientRect();
        const e = document
          .querySelector("#editor-container")!
          .getBoundingClientRect();
        return {
          frame: { left: f.left, width: f.width, bottom: f.bottom },
          editorTop: e.top,
        };
      });
      expect(rects.frame.left).toBe(0);
      expect(rects.frame.width).toBe(390);
      expect(rects.editorTop).toBeGreaterThanOrEqual(rects.frame.bottom - 1);
      await expect(page.locator("#split-divider")).toBeHidden();
    });
  });
});
