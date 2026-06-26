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

// ビートで level を持ち上げ、毎フレーム指数減衰させる共通ベース。
// 見た目（box-shadow / background 等）は CSS クラスに持たせ、ここでは強さ
// （overlay の opacity）を level から算出して反映する。色を変える等の追加描画は
// onRender / cleanup フックで拡張する。
abstract class DecayPattern implements BeatPattern {
  abstract readonly id: string;
  abstract readonly name: string;
  // mount/unmount でトグルする CSS クラス。
  protected abstract readonly className: string;
  // opacity の上限（1=フル。全画面系は眩しすぎないよう下げる）。
  protected maxAlpha = 1;

  protected level = 0;
  // 1秒あたりの減衰率（level *= DECAY^(dt/1000)）。小さいほど速く消える。
  private static readonly DECAY_PER_SEC = 0.02;

  mount(overlay: HTMLElement): void {
    overlay.classList.add(this.className);
    overlay.style.opacity = "0";
  }

  onBeat(intensity: number, overlay: HTMLElement): void {
    // 既存の光より強ければ持ち上げる（弱いビートで上書きしない）。
    this.level = Math.max(this.level, 0.25 + intensity * 0.75);
    this.render(overlay);
  }

  onFrame(dt: number, overlay: HTMLElement): void {
    if (this.level <= 0.001) {
      if (this.level !== 0) {
        this.level = 0;
        overlay.style.opacity = "0";
      }
      return;
    }
    this.level *= Math.pow(DecayPattern.DECAY_PER_SEC, dt / 1000);
    this.render(overlay);
  }

  unmount(overlay: HTMLElement): void {
    overlay.classList.remove(this.className);
    overlay.style.opacity = "0";
    this.level = 0;
  }

  // level → overlay の opacity 反映。サブクラスから参照できるよう protected。
  protected render(overlay: HTMLElement): void {
    overlay.style.opacity = String(this.level * this.maxAlpha);
  }
}

// 枠フラッシュ: 低音ビートでウィンドウの枠が白くボワッと光る。
class FrameFlashPattern extends DecayPattern {
  readonly id = "frame-flash";
  readonly name = "Frame flash";
  protected readonly className = "beat-frame-flash";
}

// 全画面フラッシュ: 画面全体が白く明滅する（眩しすぎないよう上限を抑える）。
class FullFlashPattern extends DecayPattern {
  readonly id = "full-flash";
  readonly name = "Full flash";
  protected readonly className = "beat-full-flash";
  protected maxAlpha = 0.55;
}

// ビネット: ビートで画面の縁が暗く締まる（フラッシュの逆）。
class VignettePattern extends DecayPattern {
  readonly id = "vignette";
  readonly name = "Vignette";
  protected readonly className = "beat-vignette";
  protected maxAlpha = 0.85;
}

// リング: 画面の内側に白い枠線がくっきり明滅する。
class RingPattern extends DecayPattern {
  readonly id = "ring";
  readonly name = "Ring";
  protected readonly className = "beat-ring";
}

// カラーパルス: ビートごとに色相を進めた色で全画面を淡く染める。
class ColorPulsePattern extends DecayPattern {
  readonly id = "color-pulse";
  readonly name = "Color pulse";
  protected readonly className = "beat-color-pulse";
  protected maxAlpha = 0.45;
  private hue = 0;

  onBeat(intensity: number, overlay: HTMLElement): void {
    // 奇数度ずつ進めて毎回違う色に（乱数を使わず安定）。
    this.hue = (this.hue + 47) % 360;
    overlay.style.background = `hsl(${this.hue} 100% 55%)`;
    super.onBeat(intensity, overlay);
  }

  unmount(overlay: HTMLElement): void {
    overlay.style.background = "";
    super.unmount(overlay);
  }
}

// パターンレジストリ。id → ファクトリ。今後ここに追加していく。
const PATTERN_FACTORIES: Record<string, () => BeatPattern> = {
  "frame-flash": () => new FrameFlashPattern(),
  "full-flash": () => new FullFlashPattern(),
  vignette: () => new VignettePattern(),
  ring: () => new RingPattern(),
  "color-pulse": () => new ColorPulsePattern(),
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
