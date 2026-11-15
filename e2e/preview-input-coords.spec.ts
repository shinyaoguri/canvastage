import { test, expect, type Frame, type Page } from "@playwright/test";

// プレビューへ転送するマウス・タッチ座標がキャンバス座標になることの回帰テスト (#104)。
// 入力ブリッジ (src/preview.ts の INPUT_BRIDGE_SCRIPT) は requestAnimationFrame を
// フックして mouseX / touches を毎フレーム上書きするので、p5.js 自身の CSS 拡縮補正は
// 効かない。CSS で縮小表示した固定サイズのキャンバス (プロジェクションマッピング用の
// createCanvas(1920, 1080) など) では、ブリッジ側で倍率を掛けないと座標がずれる。
//
// p5.js は CDN から読まず、ブリッジが見るグローバル (width / height / mouseX /
// touches) と <canvas> だけを持つ偽のスケッチで検証する。ネットワークに依存せず、
// ケースごとに論理サイズ・バッキングストア・CSS を差し替えられる。

const SKETCH = {
  html: '<html><head><link rel="stylesheet" href="style.css"></head><body><canvas id="c" width="1920" height="1080"></canvas><script src="sketch.js"></script></body></html>',
  css: "body { margin: 0; overflow: hidden } canvas { display: block }",
  js: [
    "var width = 1920, height = 1080;",
    "var mouseX = 0, mouseY = 0, pmouseX = 0, pmouseY = 0, touches = [];",
    // ブリッジは rAF のコールバック直前に touches などを書き戻すので、ループを回しておく。
    "(function loop() { requestAnimationFrame(loop); })();",
  ].join("\n"),
};

// 下書きを仕込み、復元モーダルから選んでスケッチを走らせる。
// 仕込み方は e2e/draft-restore.spec.ts と同じ (アプリに DB を作らせてから書き、開き直す)。
async function runSketch(page: Page): Promise<Frame> {
  await page.goto("/");
  await page.waitForSelector(".monaco-editor .view-lines", { timeout: 20000 });
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
      id: "input-coords",
      schemaVersion: 1,
      files: SKETCH,
      projectName: "input-coords",
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

  await page.waitForFunction(() => {
    const iframe = document.querySelector<HTMLIFrameElement>("#preview-frame");
    return !!iframe?.contentDocument?.querySelector("#c");
  });
  const frame = await (
    await page.waitForSelector("#preview-frame")
  ).contentFrame();
  expect(frame).not.toBeNull();
  return frame!;
}

interface CanvasSetup {
  /** p5.js の論理サイズ (width / height) */
  logical: [number, number];
  /** バッキングストア (canvas.width / canvas.height)。pixelDensity 倍になる */
  backing: [number, number];
  /** キャンバスに当てる CSS */
  css: string;
}

async function setupCanvas(frame: Frame, setup: CanvasSetup) {
  return frame.evaluate((s) => {
    const w = window as unknown as Record<string, unknown>;
    w.width = s.logical[0];
    w.height = s.logical[1];
    const canvas = document.querySelector("canvas")!;
    canvas.width = s.backing[0];
    canvas.height = s.backing[1];
    canvas.style.cssText = s.css;
    const r = canvas.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }, setup);
}

async function readMouse(frame: Frame) {
  return frame.evaluate(() => {
    const w = window as unknown as Record<string, number>;
    return { x: w.mouseX, y: w.mouseY };
  });
}

/**
 * 親の document に (clientX, clientY) の mousemove を送り、mouseX / mouseY が
 * expected に近づくのを待つ。page.mouse を使わないのは、エディタが覆っていない
 * 画面の端ではプレビュー iframe が最前面になり、イベントが親を経由しないため
 * (そこはブリッジの守備範囲外)。ブリッジの経路だけを決定的に検証する。
 */
async function expectMouseAt(
  page: Page,
  frame: Frame,
  client: [number, number],
  expected: [number, number]
) {
  await page.evaluate(([clientX, clientY]) => {
    document.dispatchEvent(
      new MouseEvent("mousemove", { clientX, clientY, bubbles: true })
    );
  }, client);
  await expect
    .poll(
      async () => {
        const m = await readMouse(frame);
        return Math.max(
          Math.abs(m.x - expected[0]),
          Math.abs(m.y - expected[1])
        );
      },
      { message: `client ${client} → canvas ${expected}` }
    )
    .toBeLessThan(1);
}

// 1280×720 のビューポート (Desktop Chrome) に 16:9 で収める。#104 に書かれた CSS。
const FIT_16_9 =
  "display: block;" +
  "width: min(100vw, calc(100vh * 16 / 9));" +
  "height: min(100vh, calc(100vw * 9 / 16));";

test.describe("preview input coordinates", () => {
  test("CSS で縮小した固定サイズのキャンバスでマウス座標がキャンバス座標になる", async ({
    page,
  }) => {
    const frame = await runSketch(page);
    const rect = await setupCanvas(frame, {
      logical: [1920, 1080],
      backing: [1920, 1080],
      css: FIT_16_9,
    });
    // 前提: 実際に縮小表示されている (倍率 1.5)。
    expect(rect).toEqual({ left: 0, top: 0, width: 1280, height: 720 });

    await expectMouseAt(page, frame, [0, 0], [0, 0]);
    await expectMouseAt(page, frame, [640, 360], [960, 540]);
    await expectMouseAt(page, frame, [1279, 0], [1918.5, 0]);
    await expectMouseAt(page, frame, [0, 719], [0, 1078.5]);
    await expectMouseAt(page, frame, [1279, 719], [1918.5, 1078.5]);
  });

  test("倍率の基準は論理サイズで、pixelDensity(2) のバッキングストアではない", async ({
    page,
  }) => {
    const frame = await runSketch(page);
    await setupCanvas(frame, {
      logical: [640, 360],
      backing: [1280, 720],
      css: "display: block; width: 640px; height: 360px;",
    });

    await expectMouseAt(page, frame, [320, 180], [320, 180]);
    await expectMouseAt(page, frame, [639, 359], [639, 359]);
  });

  test("表示サイズと論理サイズが等しい既定テンプレートでは従来どおり", async ({
    page,
  }) => {
    const frame = await runSketch(page);
    await setupCanvas(frame, {
      logical: [1280, 720],
      backing: [1280, 720],
      css: "display: block;",
    });

    await expectMouseAt(page, frame, [100, 200], [100, 200]);
    await expectMouseAt(page, frame, [1200, 700], [1200, 700]);
  });

  test.describe("touch", () => {
    test.use({ hasTouch: true });

    test("CSS で縮小したキャンバスで touches もキャンバス座標になる", async ({
      page,
    }) => {
      const frame = await runSketch(page);
      await setupCanvas(frame, {
        logical: [1920, 1080],
        backing: [1920, 1080],
        css: FIT_16_9,
      });

      await page.evaluate(() => {
        const touch = (identifier: number, x: number, y: number) =>
          new Touch({
            identifier,
            target: document.body,
            clientX: x,
            clientY: y,
          });
        document.dispatchEvent(
          new TouchEvent("touchstart", {
            touches: [touch(1, 640, 360), touch(2, 1279, 719)],
            bubbles: true,
          })
        );
      });

      await expect
        .poll(() =>
          frame.evaluate(
            () =>
              (window as unknown as { touches: { x: number; y: number }[] })
                .touches
          )
        )
        .toEqual([
          expect.objectContaining({ x: 960, y: 540 }),
          expect.objectContaining({ x: 1918.5, y: 1078.5 }),
        ]);
    });
  });
});
