// テンポ推定とビート位相ロック（B 方式）。
//
// AudioEngine が毎フレーム計算する ODF（onset detection function = スペクトラル
// フラックス）を時刻つきで蓄積し、自己相関でテンポ（拍周期）を推定、ODF と
// インパルス列の相互相関で拍の位相を合わせて「次の拍が来る時刻」を予測する。
// 予測時刻を過ぎたフレームで拍を発火するので、生オンセット検出（裏拍・子音・
// ハイハットも拾う）と違い、フラッシュが音楽の拍グリッドに揃う。
//
// トレードオフ: ロックに数秒かかり、急なテンポ変化やルバートには弱い。仕様と
// して許容する。自己相関ピークの顕著度（confidence）が低いときは呼び出し側が
// 生オンセットへフォールバックする（無音・不定リズムでも反応を絶やさない）。
//
// 純粋 DSP 関数（median / tempoWeight / estimateTempo）は副作用がなく、合成信号
// で単体テストできるよう export している（test/beat-tracker.test.ts）。

export interface TempoEstimate {
  period: number; // 拍周期（ODF サンプル数）
  bpm: number;
  confidence: number; // 自己相関ピークの顕著度 0..1
}

// 非破壊で中央値を返す。
export function median(values: ArrayLike<number>): number {
  const n = values.length;
  if (n === 0) return 0;
  const arr = Array.prototype.slice
    .call(values)
    .sort((a: number, b: number) => a - b);
  const mid = n >> 1;
  return n % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

// 知覚的テンポ重み: 約 120BPM 付近を優先する対数正規。自己相関は真の周期だけで
// なくその整数倍ラグにもピークが立つ（倍/半テンポの曖昧さ）ので、人が取りやすい
// テンポへ寄せて選ぶための重み。
const PREFERRED_BPM = 120;
const TEMPO_SIGMA = 0.9; // log2 空間の広がり（≒1 オクターブ）
export function tempoWeight(bpm: number): number {
  const d = Math.log2(bpm / PREFERRED_BPM) / TEMPO_SIGMA;
  return Math.exp(-0.5 * d * d);
}

export interface TempoOptions {
  bpmMin?: number;
  bpmMax?: number;
}

const DEFAULT_BPM_MIN = 60;
const DEFAULT_BPM_MAX = 180;

// ODF 包絡からテンポ（拍周期）を自己相関で推定する。各候補ラグについて基本ラグ
// とその整数倍（高調波）の自己相関をコムフィルタ的に合算し、知覚重みを掛けて
// 最良ラグを選ぶ。コム合算により倍/半テンポのオクターブ誤りに強くなる。
export function estimateTempo(
  odf: ArrayLike<number>,
  rate: number,
  opts: TempoOptions = {}
): TempoEstimate | null {
  const n = odf.length;
  if (n < 16 || rate <= 0) return null;
  const bpmMin = opts.bpmMin ?? DEFAULT_BPM_MIN;
  const bpmMax = opts.bpmMax ?? DEFAULT_BPM_MAX;

  // 平均除去（DC 成分が自己相関を支配しないように）
  let mean = 0;
  for (let i = 0; i < n; i++) mean += odf[i];
  mean /= n;
  const x = new Float64Array(n);
  let energy = 0;
  for (let i = 0; i < n; i++) {
    const v = odf[i] - mean;
    x[i] = v;
    energy += v * v;
  }
  if (energy <= 1e-9) return null;

  const lagMin = Math.max(2, Math.floor((rate * 60) / bpmMax));
  const lagMax = Math.min(n - 2, Math.ceil((rate * 60) / bpmMin));
  if (lagMax <= lagMin) return null;

  // 正規化自己相関 r(lag) = Σ x[i]·x[i-lag] / energy（r(0)=1）。
  const ac = (lag: number): number => {
    let s = 0;
    for (let i = lag; i < n; i++) s += x[i] * x[i - lag];
    return s / energy;
  };

  let bestLag = -1;
  let bestScore = -Infinity;
  let bestFundamental = 0; // 選ばれたラグの基本自己相関（信頼度算出用）
  for (let lag = lagMin; lag <= lagMax; lag++) {
    const fundamental = ac(lag);
    let comb = fundamental;
    let harmonics = 1;
    for (let k = 2; k <= 4; k++) {
      const l = lag * k;
      if (l >= n) break;
      comb += ac(l) / k; // 高次ほど弱める
      harmonics++;
    }
    comb /= harmonics;
    const bpm = (rate * 60) / lag;
    const score = comb * tempoWeight(bpm);
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
      bestFundamental = fundamental;
    }
  }
  if (bestLag < 0) return null;

  // 信頼度: 選ばれた周期の正規化自己相関 r(period)（r(0)=1 基準）。明確な周期信号
  // ではピークが立って 1 に近づき、周期性の弱い雑音では小さくなる。負値は 0 に。
  const confidence = Math.max(0, Math.min(1, bestFundamental));

  return { period: bestLag, bpm: (rate * 60) / bestLag, confidence };
}

// --- ステートフルなトラッカー ---

const WINDOW_SEC = 5; // ODF 包絡の保持長
const RECALC_SEC = 0.3; // テンポ・位相の再推定間隔
// ロック成立に必要な自己相関ピークの最低顕著度。これ未満はロック不成立（呼び出し
// 側がフォールバック）。Sensitivity スライダーから setMinConfidence() で上書きする。
const DEFAULT_MIN_CONFIDENCE = 0.25;
const PHASE_CORRECTION = 0.25; // ロック中の位相補正の寄せ率（急なジャンプを避ける）

export interface BeatTrackerOptions {
  bpmMin?: number;
  bpmMax?: number;
  windowSec?: number;
  minConfidence?: number;
}

export class BeatTracker {
  private odf: number[] = [];
  private times: number[] = [];
  private windowSec: number;
  private bpmMin: number;
  private bpmMax: number;
  private minConfidence: number;

  private periodSec = 0; // 拍周期（秒）
  private confidence = 0;
  private nextBeat = 0; // 次拍の予測時刻(sec)
  private lastRecalc = 0;
  private locked = false;

  constructor(opts: BeatTrackerOptions = {}) {
    this.bpmMin = opts.bpmMin ?? DEFAULT_BPM_MIN;
    this.bpmMax = opts.bpmMax ?? DEFAULT_BPM_MAX;
    this.windowSec = opts.windowSec ?? WINDOW_SEC;
    this.minConfidence = opts.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
  }

  // ロック成立に必要な信頼度しきい値を設定する（Sensitivity スライダー由来）。
  // 低いほど弱い周期性でもロックする（＝撃ちやすい）。実行中も即反映。
  setMinConfidence(value: number): void {
    this.minConfidence = Math.max(0, Math.min(1, value));
  }

  reset(): void {
    this.odf = [];
    this.times = [];
    this.periodSec = 0;
    this.confidence = 0;
    this.nextBeat = 0;
    this.lastRecalc = 0;
    this.locked = false;
  }

  isLocked(): boolean {
    return this.locked;
  }

  getConfidence(): number {
    return this.confidence;
  }

  getBpm(): number {
    return this.periodSec > 0 ? 60 / this.periodSec : 0;
  }

  // ODF を 1 サンプル投入する。拍を発火すべきフレームなら intensity(0..1) を、
  // そうでなければ null を返す。t は秒（AudioContext.currentTime 推奨）。
  process(odfValue: number, t: number): number | null {
    this.odf.push(odfValue);
    this.times.push(t);
    // 窓外の古いサンプルを落とす（最低 2 点は残す）。
    const cutoff = t - this.windowSec;
    while (this.times.length > 2 && this.times[0] < cutoff) {
      this.times.shift();
      this.odf.shift();
    }

    // 定期的にテンポ・位相を再推定する。
    if (t - this.lastRecalc >= RECALC_SEC && this.odf.length >= 16) {
      this.lastRecalc = t;
      this.recompute(t);
    }

    if (!this.locked || this.periodSec <= 0) return null;

    // 予測拍時刻を過ぎたら発火し、次拍へ進める。大きく遅れていればグリッドに追いつく。
    if (t >= this.nextBeat) {
      while (t - this.nextBeat > this.periodSec * 1.5) {
        this.nextBeat += this.periodSec;
      }
      const intensity = this.beatIntensity();
      this.nextBeat += this.periodSec;
      return intensity;
    }
    return null;
  }

  // ODF 列の実効サンプルレート（rAF ジッタを均すため時刻の総スパンから算出）。
  private effectiveRate(): number {
    const n = this.times.length;
    if (n < 2) return 0;
    const span = this.times[n - 1] - this.times[0];
    return span > 0 ? (n - 1) / span : 0;
  }

  private recompute(t: number): void {
    const rate = this.effectiveRate();
    if (rate <= 0) {
      this.locked = false;
      this.confidence = 0;
      return;
    }
    const est = estimateTempo(this.odf, rate, {
      bpmMin: this.bpmMin,
      bpmMax: this.bpmMax,
    });
    if (!est || est.confidence < this.minConfidence) {
      this.locked = false;
      this.confidence = est?.confidence ?? 0;
      return;
    }
    this.periodSec = est.period / rate;
    this.confidence = est.confidence;

    // 位相: 直近の拍に当たる ODF インデックスを求め、その時刻を基準に拍を予測する。
    const phaseIdx = this.estimatePhaseIndex(est.period);
    const lastBeatTime = this.times[phaseIdx] ?? t;
    let target = lastBeatTime;
    while (target <= t) target += this.periodSec;

    if (this.locked) {
      // ロック中は急なジャンプを避け、最寄り拍への位相差ぶんだけ緩く寄せる。
      let diff = target - this.nextBeat;
      diff -= Math.round(diff / this.periodSec) * this.periodSec;
      this.nextBeat += diff * PHASE_CORRECTION;
      if (this.nextBeat <= t) this.nextBeat = target;
    } else {
      this.nextBeat = target;
      this.locked = true;
    }
  }

  // ODF とインパルス列（周期 period）の相互相関で、直近の拍に当たる ODF
  // インデックスを返す。末尾からオフセットを 0..period-1 で振り、周期刻みの
  // ODF 総和が最大になる位相を選ぶ。
  private estimatePhaseIndex(period: number): number {
    const n = this.odf.length;
    const last = n - 1;
    let bestOffset = 0;
    let bestSum = -Infinity;
    for (let offset = 0; offset < period; offset++) {
      let sum = 0;
      for (let idx = last - offset; idx >= 0; idx -= period) {
        sum += this.odf[idx];
      }
      if (sum > bestSum) {
        bestSum = sum;
        bestOffset = offset;
      }
    }
    return last - bestOffset;
  }

  // 発火時の強度は直近フレームの ODF ピークから（0..1 目安）。
  private beatIntensity(): number {
    const n = this.odf.length;
    let peak = 0;
    for (let i = Math.max(0, n - 3); i < n; i++) {
      if (this.odf[i] > peak) peak = this.odf[i];
    }
    return Math.max(0, Math.min(1, peak));
  }
}
