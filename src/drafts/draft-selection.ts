import {
  type DraftRecord,
  type SessionRecord,
  DRAFT_TTL_MS,
  MAX_DRAFTS,
  SESSION_STALE_MS,
} from "./draft-types";

// 「どのドラフトを復元候補に出すか」「どれを捨てるか」の判定だけを集めたモジュール。
// IndexedDB にも DOM にも触れず、現在時刻も必ず引数で受け取る（内部で Date.now を
// 呼ばない）ので、node 環境のユニットテストでそのまま検証できる。

/** 他のタブが今どのドラフト / Gist を握っているか。 */
export interface LivePeer {
  tabId: string;
  draftId: string | null;
  gistId: string | null;
}

export interface LiveSet {
  draftIds: Set<string>;
  gistIds: Set<string>;
}

/**
 * 経過時間。端末の時計が巻き戻っても負にならないようクランプする
 * （負のまま比較すると「未来に更新されたドラフト」を誤って期限切れ扱いしうる）。
 */
export function elapsed(since: number, now: number): number {
  return Math.max(0, now - since);
}

export function isExpired(draft: DraftRecord, now: number): boolean {
  return elapsed(draft.updatedAt, now) > DRAFT_TTL_MS;
}

/**
 * 「今どこかのタブで開かれている」ドラフト / Gist を割り出す。
 *
 * BroadcastChannel の pong が返ったタブは確実に生きている。返らなかったタブは
 * ハートビートで判断し、まだ新しければ生きている扱いにする（BroadcastChannel が
 * 使えない環境と、応答が間に合わなかった場合の保険）。
 * つまり判断がつかないものは安全側＝生きている扱いに倒す。誤って除外しても
 * 90 秒待てば候補に出てくるだけだが、誤って復元させると二重編集で内容を失う。
 */
export function mergeLiveIds(input: {
  pongs: LivePeer[];
  sessions: SessionRecord[];
  now: number;
  selfTabId?: string;
}): LiveSet {
  const { pongs, sessions, now, selfTabId } = input;
  const draftIds = new Set<string>();
  const gistIds = new Set<string>();
  const add = (peer: { draftId: string | null; gistId: string | null }) => {
    if (peer.draftId) draftIds.add(peer.draftId);
    if (peer.gistId) gistIds.add(peer.gistId);
  };

  const responded = new Set(pongs.map((p) => p.tabId));
  for (const peer of pongs) add(peer);

  for (const session of sessions) {
    // 自分自身は pong を返さない（BroadcastChannel は自タブに配送しない）ので、
    // 明示的に除外しないと自分のドラフトを他人のものと誤認してしまう。
    if (session.tabId === selfTabId) continue;
    if (responded.has(session.tabId)) continue;
    if (elapsed(session.heartbeatAt, now) > SESSION_STALE_MS) continue;
    add(session);
  }

  return { draftIds, gistIds };
}

/** 復元モーダルに出す候補。新しい順。 */
export function selectCandidates(input: {
  drafts: DraftRecord[];
  liveDraftIds: Set<string>;
  now: number;
}): DraftRecord[] {
  const { drafts, liveDraftIds, now } = input;
  return drafts
    .filter((d) => !isExpired(d, now))
    .filter((d) => !liveDraftIds.has(d.id))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * 掃除対象。期限切れのドラフトと、上限を超えた古いドラフト、および
 * もう居ないタブのセッションを返す。
 * 開かれているドラフトは期限切れでも消さない（何日も開きっぱなしのタブから
 * 編集中のスケッチを奪わないため）。
 */
export function selectGarbage(input: {
  drafts: DraftRecord[];
  sessions: SessionRecord[];
  liveDraftIds: Set<string>;
  now: number;
}): { draftIds: string[]; tabIds: string[] } {
  const { drafts, sessions, liveDraftIds, now } = input;
  const removable = drafts.filter((d) => !liveDraftIds.has(d.id));

  const expired = removable.filter((d) => isExpired(d, now));
  const overflow = removable
    .filter((d) => !isExpired(d, now))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(MAX_DRAFTS);

  const draftIds = [...new Set([...expired, ...overflow].map((d) => d.id))];
  const tabIds = sessions
    .filter((s) => elapsed(s.heartbeatAt, now) > SESSION_STALE_MS)
    .map((s) => s.tabId);

  return { draftIds, tabIds };
}

export function formatRelativeTime(ts: number, now: number): string {
  const seconds = Math.floor(elapsed(ts, now) / 1000);
  if (seconds < 60) return "たった今";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  return `${Math.floor(hours / 24)}日前`;
}

export interface DraftSummary {
  name: string;
  meta: string;
}

/**
 * 復元モーダルの 1 行に出す文字列。DOM には触れず、文字列だけを返す。
 * Gist の所有者を出すのは、過去に取り込んだ第三者のコードを「前回の続き」として
 * 何と知らずに実行させないため。
 */
export function summarizeDraft(draft: DraftRecord, now: number): DraftSummary {
  const lines =
    countLines(draft.files.js) +
    countLines(draft.files.html) +
    countLines(draft.files.css);
  const parts = [
    `${formatRelativeTime(draft.updatedAt, now)}に編集`,
    `${lines}行`,
  ];
  if (draft.gistOwnerLogin) {
    parts.push(`Gist: ${draft.gistOwnerLogin}`);
  } else if (draft.gistId) {
    parts.push("Gist 連携あり");
  }
  return {
    name: draft.projectName.trim() || "(名前なし)",
    meta: parts.join(" · "),
  };
}

function countLines(text: string): number {
  if (!text) return 0;
  return text.split("\n").length;
}
