import type { Files } from "./preview";
import {
  getStoredToken,
  storeToken,
  clearToken,
  initiateOAuth,
} from "./github-auth";
import { createGist, updateGist, GistError } from "./gist";
import { generateProjectName } from "./project-name";

type ShareState = "idle" | "authenticating" | "sharing";

export class ShareButton {
  private btn: HTMLButtonElement;
  private state: ShareState = "idle";
  private getFiles: () => Files;
  private gistId: string | null = null;
  private dirty = false;
  private projectName: string;

  constructor(container: HTMLElement, getFiles: () => Files) {
    this.getFiles = getFiles;
    this.projectName = generateProjectName();

    this.btn = document.createElement("button");
    this.btn.id = "share-btn";
    this.btn.className = "toolbar-btn";
    this.btn.title = "Share as Gist";
    this.btn.innerHTML = `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>`;
    this.btn.onclick = () => this.handleClick();
    container.appendChild(this.btn);
  }

  markDirty(): void {
    if (!this.dirty) {
      this.dirty = true;
      this.updateDirtyState();
    }
  }

  setProjectName(name: string): void {
    this.projectName = name;
  }

  getProjectName(): string {
    return this.projectName;
  }

  resetProject(): string {
    this.gistId = null;
    this.dirty = false;
    this.projectName = generateProjectName();
    this.updateDirtyState();
    return this.projectName;
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
      const files = this.getFiles();
      const description = `${this.projectName} — canvastage sketch`;

      try {
        let result;
        if (this.gistId) {
          showToast("Gistを更新中...", "info");
          result = await updateGist(token, this.gistId, files, description);
          showToast("Gistを更新しました！", "success", result.url);
        } else {
          showToast("Gistを作成中...", "info");
          result = await createGist(token, files, description);
          showToast("Gistを作成しました！", "success", result.url);
        }
        this.gistId = result.id;
        this.dirty = false;
        this.updateDirtyState();
      } catch (err) {
        if (err instanceof GistError && err.code === "auth") {
          await clearToken();
          showToast(
            "セッションが期限切れです。もう一度お試しください。",
            "error"
          );
        } else {
          const msg =
            err instanceof Error
              ? err.message
              : "Gistの保存に失敗しました。";
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

  private updateDirtyState(): void {
    const hasSaved = this.gistId !== null;
    this.btn.classList.toggle("saved", hasSaved && !this.dirty);
    this.btn.classList.toggle("dirty", this.dirty);
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
