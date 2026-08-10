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
 * BroadcastChannel が使える環境なら、生きているタブは必ず pong を返すので
 * それが確定的な答えになる。ここでハートビートも併用してはいけない:
 * タブを閉じるときのセッション削除はページ破棄中の IndexedDB 書き込みで
 * 完了保証が無く、閉じたはずのタブのレコードが残ることがある。併用すると
 * その残骸のせいで「閉じたのに 90 秒間復元できない」状態になる。
 *
 * ハートビートは BroadcastChannel が使えない環境の代用に限る。そちらでは
 * 判断がつかないものを安全側＝生きている扱いに倒す。
 *
 * 応答が 1 往復に間に合わなかったタブを取り違える余地は残るが、その場合も
 * 復元時の claim が衝突して分岐するので、両方の内容が消えることはない。
 */
export function mergeLiveIds(input: {
  pongs: LivePeer[];
  sessions: SessionRecord[];
  now: number;
  selfTabId?: string;
  broadcastAvailable: boolean;
}): LiveSet {
  const { pongs, sessions, now, selfTabId, broadcastAvailable } = input;
  const draftIds = new Set<string>();
  const gistIds = new Set<string>();
  const add = (peer: { draftId: string | null; gistId: string | null }) => {
    if (peer.draftId) draftIds.add(peer.draftId);
    if (peer.gistId) gistIds.add(peer.gistId);
  };

  for (const peer of pongs) add(peer);
  if (broadcastAvailable) return { draftIds, gistIds };

  for (const session of sessions) {
    // 自分自身は pong を返さない（BroadcastChannel は自タブに配送しない）ので、
    // 明示的に除外しないと自分のドラフトを他人のものと誤認してしまう。
    if (session.tabId === selfTabId) continue;
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
  /** サムネイルが無いときに代わりに見せるコードの抜粋。 */
  codePreview: string;
}

/**
 * コードの見た目の手がかりになる行だけを抜き出す。
 * 空行と行コメントだけの行は落とし、先頭のインデントも揃えて詰める。
 */
function pickCodePreview(js: string, maxLines = 4): string {
  const lines = js
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("//"));
  return lines.slice(0, maxLines).join("\n");
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
    codePreview: pickCodePreview(draft.files.js),
  };
}

function countLines(text: string): number {
  if (!text) return 0;
  return text.split("\n").length;
}
