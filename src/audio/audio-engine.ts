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

// --- オンセット（ビート）検出パラメータ ---
//
// 方式: スペクトラルフラックス + 適応閾値。
// 「絶対エネルギーが平均を超えたか」ではなく「スペクトルが前フレームから急に
// 増えたか（＝アタックの立ち上がり）」を見るので、定常的な雑音（大きくても
// 変化しない音）は拾わず、キックや手拍子のような過渡音だけを拾える。
//
// 検出帯域: 低域(キック/ベース)〜低中域(手拍子/スネア)。高域のヒスは除く。
const FLUX_BAND_HZ = { min: 30, max: 4000 };
// 低域レベル表示(onLevel)用の帯域。
const LOW_BAND_HZ = { min: 20, max: 150 };
// フラックス履歴の長さ（フレーム数 ≒ 0.7s @60fps）。適応閾値の母数。
const HISTORY_SIZE = 43;
// 閾値判定を始めるのに必要な最低履歴数。
const MIN_HISTORY = 12;
// 連続発火を防ぐ不応期(ms)。手拍子の連打を潰しすぎない程度。
const REFRACTORY_MS = 130;
// 適応閾値 = 平均 + K*標準偏差 + FLOOR。near-silence の微小フラックスを無視する床。
const FLUX_FLOOR = 0.006;

// 感度(0..1) → 標準偏差係数 K への変換。
// 感度 0 = 厳しめ（K 大: 平均から大きく外れた強いオンセットのみ）、
// 感度 1 = 緩め（K 小: 小さなオンセットでも拾う）。
const K_STRICT = 3.5;
const K_LOOSE = 1.0;
export function sensitivityToK(sensitivity: number): number {
  const s = Math.min(1, Math.max(0, sensitivity));
  return K_STRICT + (K_LOOSE - K_STRICT) * s;
}
const DEFAULT_K = sensitivityToK(0.6);

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private freq: Uint8Array<ArrayBuffer> | null = null;
  // 前フレームのスペクトル（フラックス計算用）。
  private prevFreq: Uint8Array<ArrayBuffer> | null = null;
  private rafId: number | null = null;
  private running = false;

  // フラックスの履歴と直前値（適応閾値とピーク判定用）。
  private fluxHistory: number[] = [];
  private prevFlux = 0;
  private lastBeatAt = 0;
  // 感度由来の標準偏差係数 K。実行中も変更可。
  private fluxK = DEFAULT_K;
  // requestAnimationFrame には時刻が渡るので Date.now を使わずに済む。
  private now = 0;

  isRunning(): boolean {
    return this.running;
  }

  // 感度(0..1)を設定する。実行中でも即反映される。
  setSensitivity(sensitivity: number): void {
    this.fluxK = sensitivityToK(sensitivity);
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
    // フラックスは前フレームとの差なので、時間平滑は弱めにして過渡音を残す。
    analyser.smoothingTimeConstant = 0.15;
    srcNode.connect(analyser); // destination へは繋がない（ハウリング/二重再生防止）

    this.ctx = ctx;
    this.analyser = analyser;
    this.freq = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    this.prevFreq = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    this.fluxHistory = [];
    this.prevFlux = 0;
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
    const prev = this.prevFreq!;
    const binHz = ctx.sampleRate / analyser.fftSize;

    const clampBin = (hz: number) =>
      Math.min(freq.length - 1, Math.max(1, Math.round(hz / binHz)));
    const lowStart = clampBin(LOW_BAND_HZ.min);
    const lowEnd = clampBin(LOW_BAND_HZ.max);
    const fluxStart = clampBin(FLUX_BAND_HZ.min);
    const fluxEnd = clampBin(FLUX_BAND_HZ.max);

    const tick = (t: number) => {
      if (!this.running) return;
      this.now = t;
      analyser.getByteFrequencyData(freq);

      // スペクトラルフラックス: 帯域内の「正の増分」だけを合計（立ち上がり）。
      let fluxSum = 0;
      for (let i = fluxStart; i <= fluxEnd; i++) {
        const d = freq[i] - prev[i];
        if (d > 0) fluxSum += d;
      }
      const flux = fluxSum / ((fluxEnd - fluxStart + 1) * 255);

      // 低域レベル（onLevel 用、0..1）
      let lowSum = 0;
      for (let i = lowStart; i <= lowEnd; i++) lowSum += freq[i];
      const low = lowSum / ((lowEnd - lowStart + 1) * 255);

      // 全帯域の平均（おまけのレベル指標、0..1）
      let allSum = 0;
      for (let i = 0; i < freq.length; i++) allSum += freq[i];
      const overall = allSum / (freq.length * 255);

      prev.set(freq); // 次フレームのフラックス用に保存

      cb.onLevel?.(low, overall);
      this.detectOnset(flux, cb);

      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  // フラックスの適応閾値（平均 + K*標準偏差 + 床）を超え、かつ立ち上がり中で
  // 不応期を過ぎていればオンセットとみなす。定常ノイズは平均/標準偏差が高く
  // なるため弾かれ、過渡音（キック/手拍子）だけが閾値を超える。
  private detectOnset(flux: number, cb: AudioEngineCallbacks): void {
    const hist = this.fluxHistory;
    if (hist.length >= MIN_HISTORY) {
      const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
      let varSum = 0;
      for (const v of hist) varSum += (v - mean) * (v - mean);
      const std = Math.sqrt(varSum / hist.length);
      const threshold = mean + this.fluxK * std + FLUX_FLOOR;

      const isOnset =
        flux > threshold &&
        flux >= this.prevFlux && // 立ち上がりフレームで発火（持続では撃たない）
        this.now - this.lastBeatAt > REFRACTORY_MS;

      if (isOnset) {
        this.lastBeatAt = this.now;
        // 閾値超過分を 0..1 に正規化（強いアタックほど 1 に近い）。
        const intensity = Math.min(
          1,
          (flux - threshold) / Math.max(std * 2, 0.02)
        );
        cb.onBeat?.(intensity);
      }
    }

    this.prevFlux = flux;
    hist.push(flux);
    if (hist.length > HISTORY_SIZE) hist.shift();
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
    this.prevFreq = null;
    if (this.ctx) {
      try {
        await this.ctx.close();
      } catch {
        /* 既に閉じている等は無視 */
      }
      this.ctx = null;
    }
    this.fluxHistory = [];
    this.prevFlux = 0;
  }
}
