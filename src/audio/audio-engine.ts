// 音声入力（マイク or タブ/システム音声）を取り込み、低域エネルギーから
// ビートを検出して通知する。生 Web Audio API のみで完結（依存追加なし）。
//
// 解析した音は出力（destination）へは繋がない。マイクをスピーカーへ戻すと
// ハウリングし、タブ音声は元タブで既に鳴っているため二重再生になるため。

import { median, BeatTracker } from "./beat-tracker";

export type AudioSourceKind = "mic" | "tab";

// ビート検出方式。
// - "onset": スペクトラルフラックスの立ち上がり（アタック）をそのまま発火。
//   反応は速いが裏拍・子音・ハイハットも拾う。
// - "lock": テンポを推定して拍グリッドに位相同期し、予測拍時刻で発火（B 方式）。
//   音楽の拍に揃うが、ロックに数秒かかる。ロック未成立中は onset へフォールバック。
export type BeatMode = "onset" | "lock";

// タブ/システム音声の取得（getDisplayMedia + audio）は Chromium 系のみ実用的。
// Firefox / Safari は getDisplayMedia の音声トラックを返さないため、UI 側で
// 「タブ音声」を選べないようにする判定に使う。
export function supportsTabAudio(): boolean {
  const uaData = (
    navigator as Navigator & {
      userAgentData?: { brands?: { brand: string }[] };
    }
  ).userAgentData;
  if (uaData?.brands?.length) {
    return uaData.brands.some((b) => /Chromium/i.test(b.brand));
  }
  // userAgentData 非対応（Firefox/Safari 等）は UA 文字列でフォールバック判定。
  const ua = navigator.userAgent;
  return /Chrom(e|ium)/.test(ua) && !/Firefox/.test(ua);
}

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
// 方式: スペクトル白色化 + スペクトラルフラックス + 中央値ベース適応閾値。
// 「絶対エネルギーが平均を超えたか」ではなく「スペクトルが前フレームから急に
// 増えたか（＝アタックの立ち上がり）」を見るので、定常的な雑音（大きくても
// 変化しない音）は拾わず、キックや手拍子のような過渡音だけを拾える。
// さらに各ビンを直近の最大で正規化（白色化）してから差分を取るので、鳴り続ける
// トーン（シンセパッドやボーカルの母音）に支配されず、アタック成分が際立つ。
//
// 低域レベル表示(onLevel)用の帯域。
const LOW_BAND_HZ = { min: 20, max: 150 };
// フラックス履歴の長さ（フレーム数 ≒ 0.7s @60fps）。適応閾値（中央値）の母数。
const HISTORY_SIZE = 43;
// 閾値判定を始めるのに必要な最低履歴数。
const MIN_HISTORY = 12;
// 白色化: 各ビンの「直近の最大」を緩やかに減衰させて追従させる係数。
// 0.995^60 ≒ 0.74/s なので、おおむね数秒の最大で正規化する。
const WHITEN_DECAY = 0.995;
// 白色化の最大が小さすぎる（ほぼ無音）ビンはノイズ増幅を避けて 0 とする床。
const WHITEN_EPS = 1e-3;

// 実行中に調整できるチューニング項目（設定スライダーから流し込む）。
export interface BeatTuning {
  bandMinHz: number; // 検出帯域 下限
  bandMaxHz: number; // 検出帯域 上限
  floor: number; // ノイズ床（適応閾値に加算）
  refractoryMs: number; // 連続発火を防ぐ最小間隔
}

const DEFAULT_TUNING: BeatTuning = {
  bandMinHz: 30,
  bandMaxHz: 4000,
  floor: 0.006,
  refractoryMs: 130,
};

// 感度(0..1) → 中央値倍率 mult への変換。閾値 = median(履歴)·mult + floor。
// 感度 0 = 厳しめ（mult 大: 中央値を大きく超える強いオンセットのみ）、
// 感度 1 = 緩め（mult 小: 中央値をわずかに超えれば拾う）。
const MULT_STRICT = 3.0;
const MULT_LOOSE = 1.3;
export function sensitivityToMult(sensitivity: number): number {
  const s = Math.min(1, Math.max(0, sensitivity));
  return MULT_STRICT + (MULT_LOOSE - MULT_STRICT) * s;
}
const DEFAULT_MULT = sensitivityToMult(0.6);

// 同じ感度スライダーを lock モードの信頼度しきい値へ転用する。
// 感度 0 = 厳しめ（強い周期性が無いとロックしない）、感度 1 = 緩め（弱くてもロック）。
const CONF_STRICT = 0.45;
const CONF_LOOSE = 0.12;
export function sensitivityToConfidence(sensitivity: number): number {
  const s = Math.min(1, Math.max(0, sensitivity));
  return CONF_STRICT + (CONF_LOOSE - CONF_STRICT) * s;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private freq: Uint8Array<ArrayBuffer> | null = null;
  // 白色化の状態: 各ビンの直近最大（specMax）と前フレームの白色化スペクトル。
  private specMax: Float32Array | null = null;
  private prevWhite: Float32Array | null = null;
  private rafId: number | null = null;
  private running = false;

  // フラックスの履歴と直前値（適応閾値とピーク判定用）。
  private fluxHistory: number[] = [];
  private prevFlux = 0;
  private lastBeatAt = 0;
  // 感度由来の中央値倍率 mult。実行中も変更可。
  private fluxMult = DEFAULT_MULT;
  // 帯域/床/最小間隔のチューニング。実行中も変更可。
  private tuning: BeatTuning = { ...DEFAULT_TUNING };
  // ビート検出方式（onset / lock）。実行中も変更可。
  private mode: BeatMode = "onset";
  // テンポ/位相ロック（lock モード）。ODF を時刻つきで供給する。
  private tracker = new BeatTracker();
  // requestAnimationFrame には時刻が渡るので Date.now を使わずに済む。
  private now = 0;

  isRunning(): boolean {
    return this.running;
  }

  // 感度(0..1)を設定する。onset モードの中央値倍率と lock モードの信頼度しきい値の
  // 両方へ反映する（どちらも「撃ちやすさ」の閾値）。実行中でも即反映される。
  setSensitivity(sensitivity: number): void {
    this.fluxMult = sensitivityToMult(sensitivity);
    this.tracker.setMinConfidence(sensitivityToConfidence(sensitivity));
  }

  // 帯域/床/最小間隔を設定する。実行中も即反映される。
  configure(tuning: Partial<BeatTuning>): void {
    this.tuning = { ...this.tuning, ...tuning };
  }

  // 検出方式を設定する。切り替え時はトラッカーの蓄積をリセットする。
  setMode(mode: BeatMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.tracker.reset();
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
          ? "No tab audio shared. Enable “Share tab audio” in the dialog."
          : "Couldn't get the microphone audio track.";
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
    this.specMax = new Float32Array(analyser.frequencyBinCount);
    this.prevWhite = new Float32Array(analyser.frequencyBinCount);
    this.fluxHistory = [];
    this.prevFlux = 0;
    this.lastBeatAt = 0;
    this.tracker.reset();
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
        ? "Microphone permission denied."
        : "Tab audio sharing was canceled or denied.";
    }
    if (name === "NotFoundError") {
      return "No microphone found.";
    }
    return source === "mic"
      ? "Couldn't start the microphone."
      : "Couldn't start tab audio.";
  }

  private loop(cb: AudioEngineCallbacks): void {
    const analyser = this.analyser!;
    const ctx = this.ctx!;
    const freq = this.freq!;
    const specMax = this.specMax!;
    const prevWhite = this.prevWhite!;
    const binHz = ctx.sampleRate / analyser.fftSize;

    const clampBin = (hz: number) =>
      Math.min(freq.length - 1, Math.max(1, Math.round(hz / binHz)));
    const lowStart = clampBin(LOW_BAND_HZ.min);
    const lowEnd = clampBin(LOW_BAND_HZ.max);

    const tick = (t: number) => {
      if (!this.running) return;
      this.now = t;
      analyser.getByteFrequencyData(freq);

      // 検出帯域は実行中に変わりうるので毎フレーム算出（下限>上限でも安全に並べ替え）。
      const a = clampBin(this.tuning.bandMinHz);
      const b = clampBin(this.tuning.bandMaxHz);
      const fluxStart = Math.min(a, b);
      const fluxEnd = Math.max(a, b);

      // 白色化スペクトラルフラックス: 各ビンを直近の最大で正規化してから前フレーム
      // との「正の増分」だけを合計する。鳴り続けるトーンは正規化値がほぼ一定（≒1）で
      // 増分が出ず、アタック（急に立ち上がるビン）だけがフラックスに寄与する。
      let fluxSum = 0;
      for (let i = fluxStart; i <= fluxEnd; i++) {
        const v = freq[i] / 255; // 0..1
        const m = Math.max(v, specMax[i] * WHITEN_DECAY);
        specMax[i] = m;
        const w = m > WHITEN_EPS ? v / m : 0;
        const d = w - prevWhite[i];
        if (d > 0) fluxSum += d;
        prevWhite[i] = w;
      }
      const flux = fluxSum / (fluxEnd - fluxStart + 1);

      // 低域レベル（onLevel 用、0..1）
      let lowSum = 0;
      for (let i = lowStart; i <= lowEnd; i++) lowSum += freq[i];
      const low = lowSum / ((lowEnd - lowStart + 1) * 255);

      // 全帯域の平均（おまけのレベル指標、0..1）
      let allSum = 0;
      for (let i = 0; i < freq.length; i++) allSum += freq[i];
      const overall = allSum / (freq.length * 255);

      cb.onLevel?.(low, overall);
      this.detectBeat(flux, ctx.currentTime, cb);

      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  // モードに応じて拍を発火する。onset モードは生オンセットをそのまま、lock モードは
  // テンポ/位相ロックの予測拍を発火し、ロック未成立中は生オンセットへフォールバック
  // する。どちらのモードでもオンセット検出の状態（履歴・白色化）は毎フレーム更新する。
  private detectBeat(
    flux: number,
    audioTime: number,
    cb: AudioEngineCallbacks
  ): void {
    const onset = this.detectOnset(flux);

    if (this.mode === "lock") {
      const beat = this.tracker.process(flux, audioTime);
      if (this.tracker.isLocked()) {
        if (beat !== null) cb.onBeat?.(beat);
      } else if (onset !== null) {
        cb.onBeat?.(onset); // ロック未成立 → 生オンセットで反応を絶やさない
      }
      return;
    }

    if (onset !== null) cb.onBeat?.(onset);
  }

  // 中央値ベースの適応閾値（median(履歴)·mult + 床）を超え、かつ立ち上がり中で
  // 不応期を過ぎていればオンセットとみなし、その強度(0..1)を返す（無ければ null）。
  // 中央値は平均+標準偏差より外れ値（過去のオンセット自身）に引きずられにくく、
  // 単発の強打が直後の閾値を不必要に押し上げない。
  private detectOnset(flux: number): number | null {
    const hist = this.fluxHistory;
    let result: number | null = null;
    if (hist.length >= MIN_HISTORY) {
      const med = median(hist);
      const threshold = med * this.fluxMult + this.tuning.floor;

      const isOnset =
        flux > threshold &&
        flux >= this.prevFlux && // 立ち上がりフレームで発火（持続では撃たない）
        this.now - this.lastBeatAt > this.tuning.refractoryMs;

      if (isOnset) {
        this.lastBeatAt = this.now;
        // 閾値超過分を 0..1 に正規化（強いアタックほど 1 に近い）。
        result = Math.min(1, (flux - threshold) / Math.max(med * 2, 0.02));
      }
    }

    this.prevFlux = flux;
    hist.push(flux);
    if (hist.length > HISTORY_SIZE) hist.shift();
    return result;
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
    this.specMax = null;
    this.prevWhite = null;
    this.tracker.reset();
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
