// 分割表示の仕切り。ドラッグ・キーボードでエディタ側の幅の割合を変える。
//
// 表示/非表示は CSS（html[data-layout="split"] のときだけ出る）に任せ、
// ここは比率の操作だけを持つ。ドラッグ中は CSS 変数を直接書き換えるだけで
// 設定には書かず、離したときに onCommit で 1 回だけ確定する
// （IndexedDB への書き込みをポインタ移動のたびに連発しないため）。

export const SPLIT_RATIO_MIN = 0.2;
export const SPLIT_RATIO_MAX = 0.8;
export const SPLIT_RATIO_DEFAULT = 0.5;
const KEY_STEP = 0.02;

/**
 * 分割表示の切り替えショートカット ⌘/Ctrl + \ か。JIS 配列では ¥ キーになる。
 * 物理キー (code) の Backslash では判定しない — JIS ではその位置が ] で、
 * ⌘+] (ブラウザの「進む」) を奪ってしまう。文字 (key) で見て、¥ が文字を
 * 返さない環境向けに IntlYen だけを補う。プレビュー iframe 内の中継
 * (src/preview.ts の INPUT_BRIDGE_SCRIPT) も同じ判定をしている。
 */
export function isSplitToggleShortcut(e: KeyboardEvent): boolean {
  if (!(e.metaKey || e.ctrlKey) || e.isComposing || e.keyCode === 229) {
    return false;
  }
  return e.key === "\\" || e.key === "¥" || e.code === "IntlYen";
}

export function clampSplitRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return SPLIT_RATIO_DEFAULT;
  return Math.min(SPLIT_RATIO_MAX, Math.max(SPLIT_RATIO_MIN, ratio));
}

export class SplitDivider {
  private readonly el: HTMLDivElement;
  private ratio: number;

  constructor(
    container: HTMLElement,
    initialRatio: number,
    private readonly onCommit: (ratio: number) => void
  ) {
    this.ratio = clampSplitRatio(initialRatio);

    this.el = document.createElement("div");
    this.el.id = "split-divider";
    this.el.setAttribute("role", "separator");
    this.el.setAttribute("aria-orientation", "vertical");
    this.el.setAttribute("aria-label", "エディタとプレビューの境界");
    this.el.setAttribute("aria-valuemin", String(SPLIT_RATIO_MIN * 100));
    this.el.setAttribute("aria-valuemax", String(SPLIT_RATIO_MAX * 100));
    this.el.tabIndex = 0;
    this.el.title = "ドラッグで幅を変更（ダブルクリックで半分に戻す）";
    this.syncAria();
    container.appendChild(this.el);

    this.bindPointer();
    this.bindKeyboard();
    this.el.addEventListener("dblclick", () =>
      this.commit(SPLIT_RATIO_DEFAULT)
    );
  }

  /** 設定側（リセット等）で比率が変わったときに見た目の状態を合わせる。 */
  setRatio(ratio: number): void {
    this.ratio = clampSplitRatio(ratio);
    this.syncAria();
  }

  private syncAria(): void {
    this.el.setAttribute("aria-valuenow", String(Math.round(this.ratio * 100)));
  }

  // ドラッグ中の見た目だけを変える（設定には書かない）。
  private preview(ratio: number): void {
    this.ratio = clampSplitRatio(ratio);
    document.documentElement.style.setProperty(
      "--split-ratio",
      String(this.ratio)
    );
    this.syncAria();
  }

  private commit(ratio: number): void {
    this.preview(ratio);
    this.onCommit(this.ratio);
  }

  private bindPointer(): void {
    const root = document.documentElement;
    let dragging = false;

    const ratioAt = (clientX: number) => clientX / window.innerWidth;

    this.el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      dragging = true;
      this.el.setPointerCapture(e.pointerId);
      // iframe の上をまたぐとイベントを iframe に取られるので、ドラッグ中は
      // プレビューの pointer-events を切る（CSS 側で .split-dragging を見る）。
      root.classList.add("split-dragging");
    });

    this.el.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      this.preview(ratioAt(e.clientX));
    });

    const end = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      root.classList.remove("split-dragging");
      if (this.el.hasPointerCapture(e.pointerId)) {
        this.el.releasePointerCapture(e.pointerId);
      }
      this.commit(this.ratio);
    };
    this.el.addEventListener("pointerup", end);
    this.el.addEventListener("pointercancel", end);
  }

  private bindKeyboard(): void {
    this.el.addEventListener("keydown", (e) => {
      let next: number | null = null;
      if (e.key === "ArrowLeft") next = this.ratio - KEY_STEP;
      else if (e.key === "ArrowRight") next = this.ratio + KEY_STEP;
      else if (e.key === "Home") next = SPLIT_RATIO_MIN;
      else if (e.key === "End") next = SPLIT_RATIO_MAX;
      if (next === null) return;
      e.preventDefault();
      this.commit(next);
    });
  }
}
