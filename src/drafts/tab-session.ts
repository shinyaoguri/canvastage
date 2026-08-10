import { putSession, deleteSessions } from "./draft-store";
import { HEARTBEAT_INTERVAL_MS, PING_TIMEOUT_MS } from "./draft-types";
import type { LivePeer } from "./draft-selection";

// 「このタブが今どのドラフト / Gist を握っているか」を他のタブへ知らせ、
// 逆に他のタブが何を握っているかを知るための仕組み。二段構えになっている。
//
//   1. BroadcastChannel — 即座に分かるが、対応していないブラウザがある
//   2. IndexedDB 上のハートビート — 遅いが、どこでも動く保険
//
// クリーンに閉じたときは bye + セッション削除で即座に解放するが、クラッシュ時は
// ハートビートが途絶えるのを待つ（SESSION_STALE_MS）。

const CHANNEL_NAME = "canvastage-drafts";

type DraftBusMessage =
  | { type: "ping"; nonce: string; from: string }
  | {
      type: "pong";
      nonce: string;
      from: string;
      draftId: string | null;
      gistId: string | null;
    }
  | {
      type: "claim";
      from: string;
      at: number;
      draftId: string | null;
      gistId: string | null;
    }
  | { type: "bye"; from: string };

export interface TabSessionHandlers {
  /** 同じドラフトを他のタブが握っていた（自分が譲る）。 */
  onDraftTaken?: (draftId: string) => void;
  /** 同じ Gist を他のタブが自動更新している（自分が譲る）。 */
  onGistTaken?: (gistId: string) => void;
}

export class TabSession {
  readonly tabId = crypto.randomUUID();
  private readonly startedAt = Date.now();
  private channel: BroadcastChannel | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private draftId: string | null = null;
  private gistId: string | null = null;
  // 自分が今の draftId / gistId を握った時刻。衝突時に先着・後着を決める。
  private claimedAt = 0;
  private handlers: TabSessionHandlers = {};

  /**
   * 衝突時のハンドラは後から差す。生存確認とハートビートは起動直後に始めたいが、
   * ハンドラが参照する DraftManager はエディタ生成後にしか作れないため。
   */
  setHandlers(handlers: TabSessionHandlers): void {
    this.handlers = handlers;
  }

  start(handlers: TabSessionHandlers = {}): void {
    this.handlers = handlers;
    if (typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.addEventListener("message", this.onMessage);
    }
    this.beat();
    this.timer = setInterval(() => this.beat(), HEARTBEAT_INTERVAL_MS);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    window.addEventListener("pagehide", this.onPageHide);
    window.addEventListener("pageshow", this.onPageShow);
  }

  /** BroadcastChannel で生存確認ができるか（できるなら pong の有無が確定的な答え）。 */
  isBroadcastAvailable(): boolean {
    return this.channel !== null;
  }

  /** このタブが握っているものを更新し、他のタブへ宣言する。 */
  setHolding(draftId: string | null, gistId: string | null): void {
    if (draftId === this.draftId && gistId === this.gistId) return;
    this.draftId = draftId;
    this.gistId = gistId;
    this.claimedAt = Date.now();
    void this.beat();
    this.sendClaim();
  }

  /**
   * 他のタブに生存確認を投げ、応答を集める。
   * BroadcastChannel が無い環境では空配列（ハートビートだけで判定する）。
   */
  async discoverLive(): Promise<LivePeer[]> {
    const channel = this.channel;
    if (!channel) return [];

    const nonce = crypto.randomUUID();
    const peers = new Map<string, LivePeer>();
    const collect = (event: MessageEvent<DraftBusMessage>) => {
      const message = event.data;
      if (message?.type !== "pong" || message.nonce !== nonce) return;
      peers.set(message.from, {
        tabId: message.from,
        draftId: message.draftId,
        gistId: message.gistId,
      });
    };

    channel.addEventListener("message", collect);
    this.post({ type: "ping", nonce, from: this.tabId });
    await new Promise((resolve) => setTimeout(resolve, PING_TIMEOUT_MS));
    channel.removeEventListener("message", collect);
    return [...peers.values()];
  }

  dispose(): void {
    this.stopHeartbeat();
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    window.removeEventListener("pagehide", this.onPageHide);
    window.removeEventListener("pageshow", this.onPageShow);
    this.channel?.removeEventListener("message", this.onMessage);
    this.channel?.close();
    this.channel = null;
  }

  private beat(): void {
    void putSession({
      tabId: this.tabId,
      draftId: this.draftId,
      gistId: this.gistId,
      startedAt: this.startedAt,
      heartbeatAt: Date.now(),
    });
  }

  private stopHeartbeat(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private post(message: DraftBusMessage): void {
    try {
      this.channel?.postMessage(message);
    } catch {
      // 相手が居ない・チャンネルが閉じている等は無視してよい。
    }
  }

  private sendClaim(): void {
    if (!this.draftId && !this.gistId) return;
    this.post({
      type: "claim",
      from: this.tabId,
      at: this.claimedAt,
      draftId: this.draftId,
      gistId: this.gistId,
    });
  }

  private onMessage = (event: MessageEvent<DraftBusMessage>) => {
    const message = event.data;
    if (!message) return;
    // BroadcastChannel は送信元のタブには配送しないので、自分宛の除外は不要。
    if (message.type === "ping") {
      this.post({
        type: "pong",
        nonce: message.nonce,
        from: this.tabId,
        draftId: this.draftId,
        gistId: this.gistId,
      });
      return;
    }
    if (message.type === "claim") this.onClaim(message);
  };

  private onClaim(message: {
    from: string;
    at: number;
    draftId: string | null;
    gistId: string | null;
  }): void {
    const draftClash = Boolean(
      message.draftId && message.draftId === this.draftId
    );
    const gistClash = Boolean(message.gistId && message.gistId === this.gistId);
    if (!draftClash && !gistClash) return;

    if (this.losesTo(message)) {
      if (draftClash && this.draftId)
        this.handlers.onDraftTaken?.(this.draftId);
      if (gistClash && this.gistId) this.handlers.onGistTaken?.(this.gistId);
      return;
    }
    // 自分の方が先に握っている。相手はこちらの claim を見ていない（自分が
    // 宣言したのは相手が開く前）ので、もう一度知らせて降りてもらう。
    // 勝敗は (時刻, tabId) の全順序で決まるため、双方が勝ちを主張して
    // 送り合い続けることはない。
    this.sendClaim();
  }

  // 後から握った方が譲る。同時刻なら tabId の辞書順で決める
  // （どちらのタブも同じ規則で判定するので、必ず片方だけが残る）。
  private losesTo(other: { at: number; from: string }): boolean {
    if (this.claimedAt !== other.at) return this.claimedAt > other.at;
    return this.tabId > other.from;
  }

  private onVisibilityChange = () => {
    // 背面に回るとタイマが絞られるので、ここで最後の確実な打刻をしておく。
    if (document.visibilityState === "hidden") this.beat();
  };

  private onPageHide = (event: PageTransitionEvent) => {
    // bfcache へ入るだけなら復帰しうるので、生存を取り消さない。
    if (event.persisted) return;
    this.stopHeartbeat();
    this.post({ type: "bye", from: this.tabId });
    // ページ破棄中の IndexedDB 書き込みは完了保証が無い。届けば他のタブが
    // 90 秒待たずに復元候補に出せるという程度のベストエフォートで、
    // 届かなくても次回起動の掃除が拾う。
    void deleteSessions([this.tabId]);
  };

  private onPageShow = (event: PageTransitionEvent) => {
    if (!event.persisted) return;
    // bfcache から戻った。ハートビートを再開し、握っているものを宣言し直す。
    if (this.timer === null) {
      this.beat();
      this.timer = setInterval(() => this.beat(), HEARTBEAT_INTERVAL_MS);
    }
    this.sendClaim();
  };
}
