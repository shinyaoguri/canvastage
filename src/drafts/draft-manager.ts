import { getDraft, saveDraft } from "./draft-store";
import { TabSession } from "./tab-session";
import {
  DraftRecordSchema,
  MAX_DRAFT_BYTES,
  SAVE_DEBOUNCE_MS,
  SAVE_MAX_WAIT_MS,
  type DraftFiles,
  type FileType,
} from "./draft-types";

/** 保存すべき「今の作業状態」。main.ts が組み立てて渡す。 */
export interface DraftState {
  files: DraftFiles;
  projectName: string;
  currentFile: FileType;
  thumbnail: string | null;
  gistId: string | null;
  savedProjectName: string | null;
  gistOwnerLogin: string | null;
  gistDirty: boolean;
  openProcessingSketchId: number | null;
  openProcessingOwner: string | null;
  openProcessingDirty: boolean;
}

export interface DraftManagerDeps {
  getState: () => DraftState;
  session: TabSession;
}

/**
 * 作業状態を IndexedDB へ自動保存する。
 *
 * ドラフトは「最初の編集」で初めて作る。起動しただけ・サンプルを眺めただけの
 * タブがレコードを増やさないようにするため、実行やタブ切り替えでは作らない。
 */
export class DraftManager {
  private draftId: string | null = null;
  private createdAt = 0;
  // 直前に保存した内容。変化が無ければ書かない（毎回 1MB 書かないため）。
  private lastSaved: string | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
  private oversizeWarned = false;

  constructor(private deps: DraftManagerDeps) {}

  /** ユーザーがコードを編集した。ここだけがドラフトを新規に作る。 */
  noteEdit(): void {
    if (!this.draftId) {
      this.draftId = crypto.randomUUID();
      this.createdAt = Date.now();
    }
    this.schedule();
  }

  /**
   * 編集以外の状態変化（タブ切り替え・プロジェクト名・実行・Gist 保存など）。
   * まだドラフトが無ければ何もしない。
   * flush を立てると、取り返しの効かない識別子（gistId 等）を確実に残すため即座に書く。
   */
  noteState(opts: { flush?: boolean } = {}): void {
    if (!this.draftId) return;
    if (opts.flush) this.flushNow();
    else this.schedule();
  }

  /** 別のスケッチに切り替えた。紐付けを切り、次の編集で新しいドラフトを作る。 */
  startNewDraft(): void {
    this.clearTimers();
    this.draftId = null;
    this.lastSaved = null;
    this.deps.session.setHolding(null, null);
  }

  /** 復元したドラフトを、このタブのものとして引き継ぐ。 */
  adopt(id: string, createdAt: number): void {
    this.clearTimers();
    this.draftId = id;
    this.createdAt = createdAt;
    this.lastSaved = null;
    this.deps.session.setHolding(id, this.deps.getState().gistId);
  }

  /**
   * 同じドラフトを他のタブが握っていた場合に、こちらが新しい id へ移る。
   * ロックして片方を編集不能にするのではなく分岐させることで、どちらの内容も失わない。
   */
  forkDraft(): void {
    if (!this.draftId) return;
    this.draftId = crypto.randomUUID();
    this.createdAt = Date.now();
    this.lastSaved = null;
    this.deps.session.setHolding(this.draftId, this.deps.getState().gistId);
    this.schedule();
  }

  flushNow(): void {
    this.clearTimers();
    void this.persist().catch((error) => {
      console.warn("ドラフトの保存に失敗しました", error);
    });
  }

  dispose(): void {
    this.clearTimers();
  }

  private schedule(): void {
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.flushNow(), SAVE_DEBOUNCE_MS);
    // 打ち続けている間も、この間隔では必ず書き込む（デバウンスだけだと
    // 長文を書いている最中は一度も保存されない）。
    if (this.maxWaitTimer === null) {
      this.maxWaitTimer = setTimeout(() => this.flushNow(), SAVE_MAX_WAIT_MS);
    }
  }

  private clearTimers(): void {
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
    if (this.maxWaitTimer !== null) clearTimeout(this.maxWaitTimer);
    this.debounceTimer = null;
    this.maxWaitTimer = null;
  }

  private async persist(): Promise<void> {
    if (!this.draftId) return;

    const state = this.deps.getState();
    const fingerprint = JSON.stringify(state);
    if (fingerprint === this.lastSaved) return;

    if (new Blob([fingerprint]).size > MAX_DRAFT_BYTES) {
      this.warnOversize();
      return;
    }

    // BroadcastChannel が使えない環境のための最後の砦。同じレコードを他の
    // タブが書いていたら、相手を上書きせず自分の分を新しい id へ分岐させる。
    const existing = await getDraft(this.draftId);
    if (existing && existing.ownerTabId !== this.deps.session.tabId) {
      this.forkDraft();
    }
    this.deps.session.setHolding(this.draftId, state.gistId);

    const record = DraftRecordSchema.parse({
      ...state,
      id: this.draftId,
      createdAt: this.createdAt,
      updatedAt: Date.now(),
      ownerTabId: this.deps.session.tabId,
    });
    if (await saveDraft(record)) this.lastSaved = fingerprint;
  }

  private warnOversize(): void {
    if (this.oversizeWarned) return;
    this.oversizeWarned = true;
    console.warn(
      "スケッチが大きすぎるため自動保存を見送りました（1MB 未満にしてください）"
    );
  }
}
