import { describe, it, expect } from "vitest";
import {
  median,
  tempoWeight,
  estimateTempo,
  BeatTracker,
} from "../src/audio/beat-tracker";

// 周期 period サンプルごとに高さ 1 のスパイクを立てた合成 ODF を作る。
function spikeTrain(n: number, period: number, offset = 0): number[] {
  const a = new Array<number>(n).fill(0);
  for (let i = offset; i < n; i += period) a[i] = 1;
  return a;
}

describe("median", () => {
  it("奇数長は中央の要素", () => {
    expect(median([3, 1, 2])).toBe(2);
  });
  it("偶数長は中央 2 要素の平均", () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
  it("空配列は 0", () => {
    expect(median([])).toBe(0);
  });
  it("元配列を破壊しない", () => {
    const xs = [3, 1, 2];
    median(xs);
    expect(xs).toEqual([3, 1, 2]);
  });
});

describe("tempoWeight", () => {
  it("120BPM で最大（=1）", () => {
    expect(tempoWeight(120)).toBeCloseTo(1, 5);
  });
  it("半テンポ(60)・倍テンポ(240)は減衰し、かつ等しい（log2 対称）", () => {
    expect(tempoWeight(60)).toBeLessThan(1);
    expect(tempoWeight(60)).toBeCloseTo(tempoWeight(240), 5);
  });
});

describe("estimateTempo", () => {
  it("合成スパイク列から周期を復元する（120BPM @100Hz → period≈50）", () => {
    const rate = 100;
    const odf = spikeTrain(500, 50);
    const est = estimateTempo(odf, rate);
    expect(est).not.toBeNull();
    expect(est!.period).toBe(50);
    expect(est!.bpm).toBeCloseTo(120, 0);
    expect(est!.confidence).toBeGreaterThan(0.5);
  });

  it("オクターブ誤りを抑える: 速いスパイク(240BPM)でも知覚テンポ寄りを選ぶ", () => {
    // period 25 @100Hz = 240BPM。コム＋知覚重みで 50(120BPM) など取りやすいテンポへ。
    const rate = 100;
    const odf = spikeTrain(500, 25);
    const est = estimateTempo(odf, rate);
    expect(est).not.toBeNull();
    // 25 の整数倍（=拍の候補）に乗っていること。
    expect(est!.period % 25).toBe(0);
    expect(est!.bpm).toBeLessThanOrEqual(180);
  });

  it("無音(全ゼロ)では null", () => {
    expect(estimateTempo(new Array(200).fill(0), 100)).toBeNull();
  });

  it("白色雑音は周期性が弱く confidence が低い", () => {
    const rate = 100;
    // 決定的な擬似乱数（テスト再現性のため Math.random を使わない）。
    let seed = 12345;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const noise = Array.from({ length: 500 }, () => rnd());
    const est = estimateTempo(noise, rate);
    // 推定はできても、明確なスパイク列より confidence は低い。
    const spikes = estimateTempo(spikeTrain(500, 50), rate)!;
    expect(est!.confidence).toBeLessThan(spikes.confidence);
  });
});

describe("BeatTracker", () => {
  // rate=60Hz 相当・120BPM（0.5s 周期＝30 サンプル）のスパイク列を流し込み、
  // ロック後に拍がおおむね 0.5s 間隔で発火することを確認する。
  it("テンポにロックして拍を発火する", () => {
    const rate = 60;
    const dt = 1 / rate;
    const periodSamples = 30; // 0.5s → 120BPM
    const tracker = new BeatTracker();

    const beatTimes: number[] = [];
    const total = 60 * rate; // 60 秒ぶん
    for (let i = 0; i < total; i++) {
      const odf = i % periodSamples === 0 ? 1 : 0;
      const t = i * dt;
      const intensity = tracker.process(odf, t);
      if (intensity !== null) beatTimes.push(t);
    }

    expect(tracker.isLocked()).toBe(true);
    expect(tracker.getBpm()).toBeGreaterThan(110);
    expect(tracker.getBpm()).toBeLessThan(130);
    expect(beatTimes.length).toBeGreaterThan(50); // 60s / 0.5s ≒ 120 拍前後

    // ロック後（後半）の発火間隔が概ね 0.5s に収まる。
    const tail = beatTimes.slice(-20);
    for (let i = 1; i < tail.length; i++) {
      const gap = tail[i] - tail[i - 1];
      expect(gap).toBeGreaterThan(0.35);
      expect(gap).toBeLessThan(0.65);
    }
  });

  it("無音ではロックせず拍も発火しない", () => {
    const tracker = new BeatTracker();
    let beats = 0;
    for (let i = 0; i < 600; i++) {
      if (tracker.process(0, i / 60) !== null) beats++;
    }
    expect(tracker.isLocked()).toBe(false);
    expect(beats).toBe(0);
  });

  it("信頼度しきい値を上げると同じ入力でもロックしなくなる", () => {
    const feed = (tr: BeatTracker) => {
      let locked = false;
      for (let i = 0; i < 600; i++) {
        tr.process(i % 30 === 0 ? 1 : 0, i / 60);
        if (tr.isLocked()) locked = true;
      }
      return locked;
    };
    // 既定しきい値ではロックする。
    expect(feed(new BeatTracker())).toBe(true);
    // しきい値を 1（=ほぼ達成不能）にするとロックしない。
    const strict = new BeatTracker();
    strict.setMinConfidence(1);
    expect(feed(strict)).toBe(false);
  });

  it("reset でロック状態が解ける", () => {
    const tracker = new BeatTracker();
    for (let i = 0; i < 600; i++) {
      tracker.process(i % 30 === 0 ? 1 : 0, i / 60);
    }
    expect(tracker.isLocked()).toBe(true);
    tracker.reset();
    expect(tracker.isLocked()).toBe(false);
    expect(tracker.getBpm()).toBe(0);
  });
});
