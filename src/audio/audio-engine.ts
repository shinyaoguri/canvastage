// 音声入力（マイク or タブ/システム音声）を取り込み、低域エネルギーから
// ビートを検出して通知する。生 Web Audio API のみで完結（依存追加なし）。
//
// 解析した音は出力（destination）へは繋がない。マイクをスピーカーへ戻すと
// ハウリングし、タブ音声は元タブで既に鳴っているため二重再生になるため。

export type AudioSourceKind = "mic" | "tab";

export interface AudioEngineCallbacks {
  // ビート検出時。intensity は 0..1（ベースライン超過の強さ）。
  onBeat?: (intensity: number) => void;
  // 毎フレームの音量レベル。low/overall とも 0..1。
  onLevel?: (low: number, overall: number) => void;
  // 取得・解析の失敗（権限拒否、音声トラック無しなど）。
  onError?: (message: string) => void;
  // ユーザーがタブ共有を終了するなど、外部要因で停止したとき。
  onStop?: () => void;
}

// --- ビート検出パラメータ（MVP の既定値） ---
// 低域（おおよそキック/ベース帯）の Hz 範囲。
const LOW_BAND_HZ = { min: 20, max: 150 };
// 直近エネルギーの移動平均ウィンドウ（フレーム数 ≒ 0.7s @60fps）。
const HISTORY_SIZE = 43;
// 感度スライダー(0..1)→ビート判定の閾値（移動平均に対する倍率）への変換。
// 感度 0 = 厳しめ（強いビートのみ）、感度 1 = 緩め（小さな変化でも反応）。
const THRESHOLD_STRICT = 1.8;
const THRESHOLD_LOOSE = 1.05;
export function sensitivityToThreshold(sensitivity: number): number {
  const s = Math.min(1, Math.max(0, sensitivity));
  return THRESHOLD_STRICT + (THRESHOLD_LOOSE - THRESHOLD_STRICT) * s;
}
// 既定感度（0.6）はおおよそ従来の固定閾値 1.35 に相当する。
const DEFAULT_THRESHOLD = sensitivityToThreshold(0.6);
// これ未満の音量は無音とみなしビート判定しない（0..1）。
const MIN_ENERGY_FLOOR = 0.08;
// 連続発火を防ぐ不応期(ms)。
const REFRACTORY_MS = 110;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private freq: Uint8Array<ArrayBuffer> | null = null;
  private rafId: number | null = null;
  private running = false;

  private history: number[] = [];
  private lastBeatAt = 0;
  // 感度スライダー由来のビート判定閾値（移動平均に対する倍率）。実行中も変更可。
  private threshold = DEFAULT_THRESHOLD;
  // requestAnimationFrame には時刻が渡るので Date.now を使わずに済む。
  private now = 0;

  isRunning(): boolean {
    return this.running;
  }

  // 感度(0..1)を設定する。実行中でも即反映される。
  setSensitivity(sensitivity: number): void {
    this.threshold = sensitivityToThreshold(sensitivity);
  }

  async start(
    source: AudioSourceKind,
    cb: AudioEngineCallbacks
  ): Promise<void> {
    await this.stop();

    let stream: MediaStream;
    try {
      stream = await this.acquire(source);
    } catch (e) {
      cb.onError?.(this.describeAcquireError(source, e));
      throw e;
    }

    if (stream.getAudioTracks().length === 0) {
      stream.getTracks().forEach((t) => t.stop());
      const msg =
        source === "tab"
          ? "タブ音声が共有されていません。共有ダイアログで「タブの音声を共有」にチェックしてください。"
          : "マイクの音声トラックを取得できませんでした。";
      cb.onError?.(msg);
      throw new Error(msg);
    }

    this.stream = stream;

    // タブ取得時は video を止めて音声だけ残す（解析に video は不要）。
    stream.getVideoTracks().forEach((t) => t.stop());
    // ユーザーが共有/マイクを終了したら停止する。
    stream.getAudioTracks()[0].addEventListener("ended", () => {
      void this.stop();
      cb.onStop?.();
    });

    const ctx = new AudioContext();
    // resume はユーザー操作直後なので通常すぐ解決するが、音声出力デバイスが無い
    // 環境（ヘッドレス等）では解決しないことがある。解析自体は suspended でも
    // 進むため、ここでブロックせず投げっぱなしにする。
    void ctx.resume().catch(() => {});
    const srcNode = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.6;
    srcNode.connect(analyser); // destination へは繋がない（ハウリング/二重再生防止）

    this.ctx = ctx;
    this.analyser = analyser;
    this.freq = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    this.history = [];
    this.lastBeatAt = 0;
    this.running = true;

    this.loop(cb);
  }

  private acquire(source: AudioSourceKind): Promise<MediaStream> {
    if (source === "mic") {
      // 音楽解析向けに各種補正を切る（声向けの加工は不要）。
      return navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
    }
    // タブ/画面音声。Chrome 系は video 無しだと選択 UI が出ないため video も要求し、
    // 取得後に video トラックは停止する。
    return navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
  }

  private describeAcquireError(source: AudioSourceKind, e: unknown): string {
    const name = (e as { name?: string })?.name;
    if (name === "NotAllowedError" || name === "SecurityError") {
      return source === "mic"
        ? "マイクの使用が許可されませんでした。"
        : "タブ音声の共有がキャンセル/拒否されました。";
    }
    if (name === "NotFoundError") {
      return "利用可能なマイクが見つかりませんでした。";
    }
    return source === "mic"
      ? "マイクを開始できませんでした。"
      : "タブ音声を開始できませんでした。";
  }

  private loop(cb: AudioEngineCallbacks): void {
    const analyser = this.analyser!;
    const ctx = this.ctx!;
    const freq = this.freq!;
    const binHz = ctx.sampleRate / analyser.fftSize;
    const lowStart = Math.max(1, Math.floor(LOW_BAND_HZ.min / binHz));
    const lowEnd = Math.min(
      freq.length - 1,
      Math.ceil(LOW_BAND_HZ.max / binHz)
    );

    const tick = (t: number) => {
      if (!this.running) return;
      this.now = t;
      analyser.getByteFrequencyData(freq);

      // 低域エネルギー（0..1）
      let lowSum = 0;
      for (let i = lowStart; i <= lowEnd; i++) lowSum += freq[i];
      const low = lowSum / ((lowEnd - lowStart + 1) * 255);

      // 全帯域の平均（おまけのレベル指標、0..1）
      let allSum = 0;
      for (let i = 0; i < freq.length; i++) allSum += freq[i];
      const overall = allSum / (freq.length * 255);

      cb.onLevel?.(low, overall);
      this.detectBeat(low, cb);

      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private detectBeat(low: number, cb: AudioEngineCallbacks): void {
    const avg =
      this.history.length > 0
        ? this.history.reduce((a, b) => a + b, 0) / this.history.length
        : 0;

    const isBeat =
      this.history.length >= 8 &&
      low > MIN_ENERGY_FLOOR &&
      low > avg * this.threshold &&
      this.now - this.lastBeatAt > REFRACTORY_MS;

    if (isBeat) {
      this.lastBeatAt = this.now;
      // ベースライン超過の比率を 0..1 に正規化（強いビートほど 1 に近い）。
      const intensity = Math.min(1, (low - avg) / Math.max(avg, 0.05));
      cb.onBeat?.(intensity);
    }

    this.history.push(low);
    if (this.history.length > HISTORY_SIZE) this.history.shift();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.analyser = null;
    this.freq = null;
    if (this.ctx) {
      try {
        await this.ctx.close();
      } catch {
        /* 既に閉じている等は無視 */
      }
      this.ctx = null;
    }
    this.history = [];
  }
}
