export interface ConsoleMessage {
  level: "log" | "warn" | "error" | "info" | "debug";
  message: string;
  timestamp: number;
}

const MAX_MESSAGES = 100;

export class ConsolePanel {
  private container: HTMLElement;
  private messagesEl: HTMLElement;

  // isExpectedSource: console メッセージの送信元がプレビュー iframe かを判定する。
  // 渡された場合のみ検証し、他ウィンドウからのコンソール詐称メッセージを弾く。
  constructor(
    parent: HTMLElement,
    isExpectedSource?: (source: MessageEventSource | null) => boolean
  ) {
    this.container = document.createElement("div");
    this.container.id = "console-panel";
    this.container.className = "hidden";
    // 実行時のログ/エラーを支援技術へ通知する（role="log" + polite）。
    this.container.innerHTML = `<div class="console-messages" role="log" aria-live="polite"></div>`;
    parent.appendChild(this.container);

    this.messagesEl = this.container.querySelector(".console-messages")!;

    // iframeからのコンソールメッセージをリッスン
    window.addEventListener("message", (e) => {
      if (isExpectedSource && !isExpectedSource(e.source)) return;
      if (e.data && e.data.type === "console") {
        this.addMessage({
          level: e.data.level,
          message: e.data.message,
          timestamp: e.data.timestamp,
        });
      }
    });
  }

  addMessage(msg: ConsoleMessage): void {
    this.container.classList.remove("hidden");
    this.renderMessage(msg);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  private renderMessage(msg: ConsoleMessage): void {
    const el = document.createElement("div");
    el.className = `console-message console-${msg.level}`;
    el.textContent = msg.message;
    this.messagesEl.appendChild(el);

    // 古いメッセージを削除
    while (this.messagesEl.children.length > MAX_MESSAGES) {
      this.messagesEl.removeChild(this.messagesEl.firstChild!);
    }
  }

  clear(): void {
    this.messagesEl.innerHTML = "";
    this.container.classList.add("hidden");
  }
}
