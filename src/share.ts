import type { Files } from "./preview";
import {
  getStoredToken,
  storeToken,
  clearToken,
  initiateOAuth,
} from "./github-auth";
import { createGist, GistError } from "./gist";

type ShareState = "idle" | "authenticating" | "sharing";

export class ShareButton {
  private btn: HTMLButtonElement;
  private state: ShareState = "idle";
  private getFiles: () => Files;

  constructor(container: HTMLElement, getFiles: () => Files) {
    this.getFiles = getFiles;

    this.btn = document.createElement("button");
    this.btn.id = "share-btn";
    this.btn.className = "toolbar-btn";
    this.btn.title = "Share as Gist";
    this.btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="18" cy="5" r="3"/>
      <circle cx="6" cy="12" r="3"/>
      <circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>`;
    this.btn.onclick = () => this.handleClick();
    container.appendChild(this.btn);
  }

  private async handleClick(): Promise<void> {
    if (this.state !== "idle") return;

    try {
      let token = await getStoredToken();

      if (!token) {
        this.setState("authenticating");
        showToast("GitHubに接続中...", "info");
        try {
          token = await initiateOAuth();
          await storeToken(token);
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : "認証に失敗しました。";
          showToast(msg, "error");
          this.setState("idle");
          return;
        }
      }

      this.setState("sharing");
      showToast("Gistを作成中...", "info");
      const files = this.getFiles();

      try {
        const result = await createGist(token, files);
        showToast("Gistを作成しました！", "success", result.url);
      } catch (err) {
        if (err instanceof GistError && err.code === "auth") {
          await clearToken();
          showToast("セッションが期限切れです。もう一度お試しください。", "error");
        } else {
          const msg =
            err instanceof Error
              ? err.message
              : "Gistの作成に失敗しました。";
          showToast(msg, "error");
        }
      }
    } finally {
      this.setState("idle");
    }
  }

  private setState(state: ShareState): void {
    this.state = state;
    this.btn.classList.toggle("loading", state !== "idle");
  }
}

// ===== Toast 通知 =====

let toastContainer: HTMLElement | null = null;

function getToastContainer(): HTMLElement {
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toast-container";
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

function showToast(
  message: string,
  type: "info" | "success" | "error",
  url?: string
): void {
  const container = getToastContainer();
  container.innerHTML = "";

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  if (url) {
    const msgSpan = document.createElement("span");
    msgSpan.className = "toast-message";
    msgSpan.textContent = message;
    toast.appendChild(msgSpan);

    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "toast-link";
    link.textContent = "Open";
    toast.appendChild(link);

    const copyBtn = document.createElement("button");
    copyBtn.className = "toast-copy";
    copyBtn.title = "URLをコピー";
    copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>`;
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(url).then(() => {
        copyBtn.title = "コピーしました！";
      });
    });
    toast.appendChild(copyBtn);
  } else {
    const msgSpan = document.createElement("span");
    msgSpan.className = "toast-message";
    msgSpan.textContent = message;
    toast.appendChild(msgSpan);
  }

  container.appendChild(toast);

  const duration = url ? 8000 : 4000;
  setTimeout(() => {
    toast.classList.add("toast-exit");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
