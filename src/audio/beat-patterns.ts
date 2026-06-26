// ビート可視化パターン。各パターンはコントローラから渡される overlay 要素
// （ウィンドウ全面の固定レイヤ）を描画対象にする。
//
// 今後パターンを増やせるよう共通インターフェースに揃える。コントローラは
// ビート時に onBeat、毎フレーム onFrame(dt) を呼ぶ。パターンは自前の状態
// （減衰レベルなど）を持ち、overlay の見た目へ反映する。

export interface BeatPattern {
  readonly id: string;
  readonly name: string;
  // overlay へ初期スタイル/子要素を用意する。
  mount(overlay: HTMLElement): void;
  // ビート検出時。intensity は 0..1。
  onBeat(intensity: number, overlay: HTMLElement): void;
  // 毎フレーム。dt はミリ秒。減衰アニメーション等に使う。
  onFrame(dt: number, overlay: HTMLElement): void;
  // 後始末（次パターンへ切替時・無効化時）。
  unmount(overlay: HTMLElement): void;
}

// 枠フラッシュ: 低音ビートでウィンドウの枠が白くボワッと光り、徐々に減衰する。
// 見た目（内側グロー）は CSS（#beat-overlay）側に持たせ、ここでは強さ（opacity）
// だけを制御する。
class FrameFlashPattern implements BeatPattern {
  readonly id = "frame-flash";
  readonly name = "枠フラッシュ";

  private level = 0;
  // 1秒あたりの減衰率（level *= DECAY^(dt/1000)）。小さいほど速く消える。
  private static readonly DECAY_PER_SEC = 0.02;

  mount(overlay: HTMLElement): void {
    overlay.classList.add("beat-frame-flash");
    overlay.style.opacity = "0";
  }

  onBeat(intensity: number, overlay: HTMLElement): void {
    // 既存の光より強ければ持ち上げる（弱いビートで上書きしない）。
    this.level = Math.max(this.level, 0.25 + intensity * 0.75);
    overlay.style.opacity = String(this.level);
  }

  onFrame(dt: number, overlay: HTMLElement): void {
    if (this.level <= 0.001) {
      if (this.level !== 0) {
        this.level = 0;
        overlay.style.opacity = "0";
      }
      return;
    }
    this.level *= Math.pow(FrameFlashPattern.DECAY_PER_SEC, dt / 1000);
    overlay.style.opacity = String(this.level);
  }

  unmount(overlay: HTMLElement): void {
    overlay.classList.remove("beat-frame-flash");
    overlay.style.opacity = "0";
    this.level = 0;
  }
}

// パターンレジストリ。id → ファクトリ。今後ここに追加していく。
const PATTERN_FACTORIES: Record<string, () => BeatPattern> = {
  "frame-flash": () => new FrameFlashPattern(),
};

export const DEFAULT_PATTERN_ID = "frame-flash";

// UI（設定 select）用のパターン一覧。
export const PATTERN_OPTIONS: { value: string; label: string }[] = Object.keys(
  PATTERN_FACTORIES
).map((id) => ({ value: id, label: PATTERN_FACTORIES[id]().name }));

export function createPattern(id: string): BeatPattern {
  const factory =
    PATTERN_FACTORIES[id] ?? PATTERN_FACTORIES[DEFAULT_PATTERN_ID];
  return factory();
}
