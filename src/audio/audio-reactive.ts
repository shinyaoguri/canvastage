import { AudioEngine, type AudioSourceKind } from "./audio-engine";
import {
  createPattern,
  DEFAULT_PATTERN_ID,
  type BeatPattern,
} from "./beat-patterns";

export type AudioReactiveState = "off" | "starting" | "on" | "error";

export interface AudioReactiveStatus {
  state: AudioReactiveState;
  source: AudioSourceKind;
  message?: string;
}

export type AudioReactiveStatusListener = (s: AudioReactiveStatus) => void;

// 音声ビート可視化のコントローラ。
// - エンジン（音声取得・解析）とオーバーレイ（全面の描画レイヤ）とアクティブ
//   パターンを束ねる。
// - 既定 OFF。enable() で初めて権限を取得し解析を始める（要ユーザー操作）。
// - パターンの減衰アニメーション用に自前の描画ループ（rAF）を回す。
export class AudioReactiveController {
  private engine = new AudioEngine();
  private overlay: HTMLElement;
  private pattern: BeatPattern;
  private source: AudioSourceKind = "mic";
  private enabled = false;
  private renderRaf: number | null = null;
  private lastFrame = 0;
  private statusListener: AudioReactiveStatusListener | null = null;

  constructor(container: HTMLElement, patternId = DEFAULT_PATTERN_ID) {
    this.overlay = document.createElement("div");
    this.overlay.id = "beat-overlay";
    // 装飾レイヤなので操作は透過、支援技術からも隠す。
    this.overlay.setAttribute("aria-hidden", "true");
    container.appendChild(this.overlay);

    this.pattern = createPattern(patternId);
  }

  setStatusListener(cb: AudioReactiveStatusListener): void {
    this.statusListener = cb;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private emit(state: AudioReactiveState, message?: string): void {
    this.statusListener?.({ state, source: this.source, message });
  }

  // 音源を取得して解析・描画を開始する。失敗時は false を返し state=error を通知。
  async enable(source: AudioSourceKind): Promise<boolean> {
    this.source = source;
    this.emit("starting");
    try {
      await this.engine.start(source, {
        onBeat: (intensity) => this.pattern.onBeat(intensity, this.overlay),
        onStop: () => this.disable(),
        onError: (msg) => this.emit("error", msg),
      });
    } catch {
      this.enabled = false;
      this.stopRenderLoop();
      // 具体的なメッセージは engine の onError が emit 済み。state は error のまま。
      return false;
    }
    this.enabled = true;
    this.pattern.mount(this.overlay);
    this.startRenderLoop();
    this.emit("on");
    return true;
  }

  // 解析・描画を止め、音源を解放する。
  disable(): void {
    this.enabled = false;
    this.stopRenderLoop();
    void this.engine.stop();
    this.pattern.unmount(this.overlay);
    this.emit("off");
  }

  // 有効中に音源を切り替える（取り直し）。
  async setSource(source: AudioSourceKind): Promise<void> {
    if (!this.enabled || source === this.source) {
      this.source = source;
      return;
    }
    await this.enable(source);
  }

  // アクティブパターンを差し替える。
  setPattern(patternId: string): void {
    if (patternId === this.pattern.id) return;
    if (this.enabled) this.pattern.unmount(this.overlay);
    this.pattern = createPattern(patternId);
    if (this.enabled) this.pattern.mount(this.overlay);
  }

  private startRenderLoop(): void {
    this.stopRenderLoop();
    this.lastFrame = 0;
    const tick = (t: number) => {
      if (!this.enabled) return;
      const dt = this.lastFrame === 0 ? 16 : t - this.lastFrame;
      this.lastFrame = t;
      this.pattern.onFrame(dt, this.overlay);
      this.renderRaf = requestAnimationFrame(tick);
    };
    this.renderRaf = requestAnimationFrame(tick);
  }

  private stopRenderLoop(): void {
    if (this.renderRaf !== null) {
      cancelAnimationFrame(this.renderRaf);
      this.renderRaf = null;
    }
  }
}
