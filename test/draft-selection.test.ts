import { describe, it, expect } from "vitest";
import {
  elapsed,
  isExpired,
  mergeLiveIds,
  selectCandidates,
  selectGarbage,
  formatRelativeTime,
  summarizeDraft,
} from "../src/drafts/draft-selection";
import {
  DraftRecordSchema,
  SessionRecordSchema,
  MAX_DRAFTS,
  type DraftRecord,
  type SessionRecord,
} from "../src/drafts/draft-types";

// 判定ロジックは現在時刻を引数で受ける純粋関数なので、固定時刻で検証できる。
const NOW = 1_800_000_000_000;
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

function draft(over: Partial<DraftRecord> = {}): DraftRecord {
  return DraftRecordSchema.parse({
    id: "d1",
    files: { html: "", css: "", js: "" },
    createdAt: NOW,
    updatedAt: NOW,
    ownerTabId: "tab-1",
    ...over,
  });
}

function session(over: Partial<SessionRecord> = {}): SessionRecord {
  return SessionRecordSchema.parse({
    tabId: "tab-1",
    draftId: null,
    gistId: null,
    startedAt: NOW,
    heartbeatAt: NOW,
    ...over,
  });
}

describe("elapsed", () => {
  it("経過時間を返す", () => {
    expect(elapsed(NOW - 5 * MINUTE, NOW)).toBe(5 * MINUTE);
  });
  // 端末の時計が巻き戻ると now < since になる。負のまま扱うと比較が壊れる。
  it("未来の時刻でも負にならない", () => {
    expect(elapsed(NOW + HOUR, NOW)).toBe(0);
  });
});

describe("isExpired", () => {
  it("47時間59分前は期限内", () => {
    expect(
      isExpired(draft({ updatedAt: NOW - 47 * HOUR - 59 * MINUTE }), NOW)
    ).toBe(false);
  });
  it("48時間1分前は期限切れ", () => {
    expect(isExpired(draft({ updatedAt: NOW - 48 * HOUR - MINUTE }), NOW)).toBe(
      true
    );
  });
  it("時計がずれて未来になっていても期限切れにしない", () => {
    expect(isExpired(draft({ updatedAt: NOW + 10 * HOUR }), NOW)).toBe(false);
  });
});

describe("mergeLiveIds（BroadcastChannel あり）", () => {
  it("pong を返したタブのドラフトと Gist は生きている", () => {
    const live = mergeLiveIds({
      pongs: [{ tabId: "tab-2", draftId: "d2", gistId: "g2" }],
      sessions: [],
      now: NOW,
      broadcastAvailable: true,
    });
    expect(live.draftIds.has("d2")).toBe(true);
    expect(live.gistIds.has("g2")).toBe(true);
  });

  // タブを閉じるときのセッション削除はページ破棄中の書き込みなので完了保証が無く、
  // 閉じたタブのレコードが新しい打刻のまま残ることがある。ここでハートビートも
  // 見てしまうと「閉じたのに 90 秒間復元できない」状態になる。
  it("ハートビートが新しくても pong が無ければ生きていない", () => {
    const live = mergeLiveIds({
      pongs: [],
      sessions: [
        session({ tabId: "tab-2", draftId: "d2", heartbeatAt: NOW - 1_000 }),
      ],
      now: NOW,
      broadcastAvailable: true,
    });
    expect(live.draftIds.has("d2")).toBe(false);
  });

  it("draftId が null の pong は何も足さない", () => {
    const live = mergeLiveIds({
      pongs: [{ tabId: "tab-2", draftId: null, gistId: null }],
      sessions: [],
      now: NOW,
      broadcastAvailable: true,
    });
    expect(live.draftIds.size).toBe(0);
    expect(live.gistIds.size).toBe(0);
  });
});

describe("mergeLiveIds（BroadcastChannel なし）", () => {
  // 対応していない環境では pong が一切返らないので、ハートビートで代用する。
  // 判断がつかないものは安全側（生きている）に倒す。
  it("ハートビートが新しければ生きている扱い", () => {
    const live = mergeLiveIds({
      pongs: [],
      sessions: [
        session({ tabId: "a", draftId: "alive", heartbeatAt: NOW - 30_000 }),
        session({
          tabId: "b",
          draftId: "dead",
          heartbeatAt: NOW - 10 * MINUTE,
        }),
      ],
      now: NOW,
      broadcastAvailable: false,
    });
    expect([...live.draftIds]).toEqual(["alive"]);
  });

  it("ハートビートが 90 秒より古ければ死んでいる", () => {
    const live = mergeLiveIds({
      pongs: [],
      sessions: [
        session({ tabId: "tab-2", draftId: "d2", heartbeatAt: NOW - 120_000 }),
      ],
      now: NOW,
      broadcastAvailable: false,
    });
    expect(live.draftIds.has("d2")).toBe(false);
  });

  // 自分のセッションを除外し損ねると、自分のドラフトを他人のものと誤認して
  // 候補から消してしまう。
  it("自分自身のセッションは生存集合に入れない", () => {
    const live = mergeLiveIds({
      pongs: [],
      sessions: [session({ tabId: "me", draftId: "mine", heartbeatAt: NOW })],
      now: NOW,
      selfTabId: "me",
      broadcastAvailable: false,
    });
    expect(live.draftIds.has("mine")).toBe(false);
  });
});

describe("selectCandidates", () => {
  it("他のタブが開いているドラフトを除外する", () => {
    const drafts = [draft({ id: "open" }), draft({ id: "closed" })];
    const result = selectCandidates({
      drafts,
      liveDraftIds: new Set(["open"]),
      now: NOW,
    });
    expect(result.map((d) => d.id)).toEqual(["closed"]);
  });

  it("期限切れを除外する", () => {
    const drafts = [
      draft({ id: "old", updatedAt: NOW - 49 * HOUR }),
      draft({ id: "fresh", updatedAt: NOW - HOUR }),
    ];
    const result = selectCandidates({
      drafts,
      liveDraftIds: new Set(),
      now: NOW,
    });
    expect(result.map((d) => d.id)).toEqual(["fresh"]);
  });

  it("更新が新しい順に並べる", () => {
    const drafts = [
      draft({ id: "b", updatedAt: NOW - 2 * HOUR }),
      draft({ id: "a", updatedAt: NOW - MINUTE }),
      draft({ id: "c", updatedAt: NOW - 10 * HOUR }),
    ];
    const result = selectCandidates({
      drafts,
      liveDraftIds: new Set(),
      now: NOW,
    });
    expect(result.map((d) => d.id)).toEqual(["a", "b", "c"]);
  });

  // 候補ゼロなら起動時モーダルを出さない、という分岐がここに乗る。
  it("全部除外されたら空配列", () => {
    const result = selectCandidates({
      drafts: [draft({ id: "open" })],
      liveDraftIds: new Set(["open"]),
      now: NOW,
    });
    expect(result).toEqual([]);
  });
});

describe("selectGarbage", () => {
  it("期限切れのドラフトを掃除対象にする", () => {
    const result = selectGarbage({
      drafts: [draft({ id: "old", updatedAt: NOW - 49 * HOUR })],
      sessions: [],
      liveDraftIds: new Set(),
      now: NOW,
    });
    expect(result.draftIds).toEqual(["old"]);
  });

  // 何日も開きっぱなしのタブから編集中のスケッチを奪わない。
  it("期限切れでも開かれているドラフトは消さない", () => {
    const result = selectGarbage({
      drafts: [draft({ id: "open", updatedAt: NOW - 49 * HOUR })],
      sessions: [],
      liveDraftIds: new Set(["open"]),
      now: NOW,
    });
    expect(result.draftIds).toEqual([]);
  });

  it("上限を超えた分を古い順に捨てる", () => {
    const drafts = Array.from({ length: MAX_DRAFTS + 3 }, (_, i) =>
      draft({ id: `d${i}`, updatedAt: NOW - i * MINUTE })
    );
    const result = selectGarbage({
      drafts,
      sessions: [],
      liveDraftIds: new Set(),
      now: NOW,
    });
    expect(result.draftIds).toEqual([
      `d${MAX_DRAFTS}`,
      `d${MAX_DRAFTS + 1}`,
      `d${MAX_DRAFTS + 2}`,
    ]);
  });

  it("途絶えたセッションを掃除対象にする", () => {
    const result = selectGarbage({
      drafts: [],
      sessions: [
        session({ tabId: "gone", heartbeatAt: NOW - 5 * MINUTE }),
        session({ tabId: "here", heartbeatAt: NOW - 5_000 }),
      ],
      liveDraftIds: new Set(),
      now: NOW,
    });
    expect(result.tabIds).toEqual(["gone"]);
  });
});

describe("formatRelativeTime", () => {
  it("1分未満はたった今", () => {
    expect(formatRelativeTime(NOW - 59_000, NOW)).toBe("たった今");
  });
  it("分単位", () => {
    expect(formatRelativeTime(NOW - 3 * MINUTE, NOW)).toBe("3分前");
  });
  it("時間単位", () => {
    expect(formatRelativeTime(NOW - 2 * HOUR, NOW)).toBe("2時間前");
  });
  it("日単位", () => {
    expect(formatRelativeTime(NOW - 25 * HOUR, NOW)).toBe("1日前");
  });
});

describe("summarizeDraft", () => {
  it("名前と、編集時刻・行数の要約を返す", () => {
    const summary = summarizeDraft(
      draft({
        projectName: "neon-wave-a7f",
        files: { html: "a\nb", css: "", js: "x\ny\nz" },
        updatedAt: NOW - 2 * HOUR,
      }),
      NOW
    );
    expect(summary.name).toBe("neon-wave-a7f");
    expect(summary.meta).toBe("2時間前に編集 · 5行");
  });

  it("名前が空なら代替表記にする", () => {
    expect(summarizeDraft(draft({ projectName: "   " }), NOW).name).toBe(
      "(名前なし)"
    );
  });

  // 取り込んだ第三者のコードを、何と知らずに実行させないための表示。
  it("Gist の所有者が分かれば要約に出す", () => {
    const summary = summarizeDraft(
      draft({ gistId: "g1", gistOwnerLogin: "octocat" }),
      NOW
    );
    expect(summary.meta).toContain("Gist: octocat");
  });

  it("所有者不明の Gist 連携は連携ありとだけ示す", () => {
    const summary = summarizeDraft(draft({ gistId: "g1" }), NOW);
    expect(summary.meta).toContain("Gist 連携あり");
  });

  // サムネイルが撮れていないスケッチの代替表示に使う。
  describe("codePreview", () => {
    it("空行と行コメントだけの行を落として詰める", () => {
      const summary = summarizeDraft(
        draft({
          files: {
            html: "",
            css: "",
            js: "// 説明\n\n  circle(1, 2, 3);\n\nrect(4, 5);",
          },
        }),
        NOW
      );
      expect(summary.codePreview).toBe("circle(1, 2, 3);\nrect(4, 5);");
    });

    it("長いコードは先頭 4 行までにする", () => {
      const js = ["a();", "b();", "c();", "d();", "e();"].join("\n");
      const summary = summarizeDraft(
        draft({ files: { html: "", css: "", js } }),
        NOW
      );
      expect(summary.codePreview.split("\n")).toHaveLength(4);
    });

    it("中身が無ければ空文字", () => {
      const summary = summarizeDraft(
        draft({ files: { html: "", css: "", js: "\n\n// only comments\n" } }),
        NOW
      );
      expect(summary.codePreview).toBe("");
    });
  });
});
