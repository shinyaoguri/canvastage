import { TabSession } from "./tab-session";
import {
  loadAllDrafts,
  loadAllSessions,
  deleteDrafts,
  deleteSessions,
} from "./draft-store";
import {
  mergeLiveIds,
  selectCandidates,
  selectGarbage,
  type LiveSet,
} from "./draft-selection";
import {
  DISCOVERY_TIMEOUT_MS,
  type DraftRecord,
  type SessionRecord,
} from "./draft-types";

export interface DraftBoot {
  session: TabSession;
  /** 復元候補。必ず解決し、失敗しても空配列を返す（起動を止めない）。 */
  candidates: Promise<DraftRecord[]>;
  /** 期限切れドラフトと途絶えたセッションの掃除。候補確定後に実行する。 */
  gc: () => Promise<void>;
}

/**
 * 起動時のドラフト探索を始める。
 *
 * IndexedDB を開き、他のタブへ生存確認を投げ、自分のセッションを登録するところ
 * までをここでまとめて走らせる。呼び出し側は await せずに UI の構築を進め、
 * 最後に candidates を待つ。IndexedDB が使えない環境や応答が返らない場合でも
 * 候補なしとして進むため、この Promise が reject することもハングすることもない。
 */
export function startDraftBoot(): DraftBoot {
  const session = new TabSession();
  session.start();

  // gc が candidates の探索結果を再利用するための控え。
  let liveIds: LiveSet = { draftIds: new Set(), gistIds: new Set() };
  let allDrafts: DraftRecord[] = [];
  let allSessions: SessionRecord[] = [];

  const discover = async (): Promise<DraftRecord[]> => {
    const [pongs, drafts, sessions] = await Promise.all([
      session.discoverLive(),
      loadAllDrafts(),
      loadAllSessions(),
    ]);
    const now = Date.now();
    allDrafts = drafts;
    allSessions = sessions;
    liveIds = mergeLiveIds({
      pongs,
      sessions,
      now,
      selfTabId: session.tabId,
    });
    return selectCandidates({ drafts, liveDraftIds: liveIds.draftIds, now });
  };

  const candidates = Promise.race([
    discover().catch(() => []),
    new Promise<DraftRecord[]>((resolve) =>
      setTimeout(() => resolve([]), DISCOVERY_TIMEOUT_MS)
    ),
  ]);

  const gc = async () => {
    // 探索が終わってから掃除する。生存中のドラフトを消さないための
    // liveDraftIds が、探索の副産物として要るため。
    await candidates;
    const { draftIds, tabIds } = selectGarbage({
      drafts: allDrafts,
      sessions: allSessions,
      liveDraftIds: liveIds.draftIds,
      now: Date.now(),
    });
    await deleteDrafts(draftIds);
    await deleteSessions(tabIds.filter((id) => id !== session.tabId));
  };

  return { session, candidates, gc };
}
