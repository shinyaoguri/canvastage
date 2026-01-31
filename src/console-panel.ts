export interface ConsoleMessage {
  level: "log" | "warn" | "error" | "info" | "debug";
  message: string;
  timestamp: number;
}

const MAX_MESSAGES = 100;

export class ConsolePanel {
  private container: HTMLElement;
  private messagesEl: HTMLElement;
  private messages: ConsoleMessage[] = [];

  constructor(parent: HTMLElement) {
    this.container = document.createElement("div");
    this.container.id = "console-panel";
    this.container.className = "hidden";
    this.container.innerHTML = `<div class="console-messages"></div>`;
    parent.appendChild(this.container);

    this.messagesEl = this.container.querySelector(".console-messages")!;

    // iframeからのコンソールメッセージをリッスン
    window.addEventListener("message", (e) => {
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
    this.messages.push(msg);
    if (this.messages.length > MAX_MESSAGES) {
      this.messages.shift();
    }
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
    this.messages = [];
    this.messagesEl.innerHTML = "";
    this.container.classList.add("hidden");
  }
}
