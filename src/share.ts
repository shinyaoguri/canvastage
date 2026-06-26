import type { Files } from "./preview";
import {
  getStoredToken,
  storeToken,
  clearToken,
  initiateOAuth,
} from "./github-auth";
import { createGist, updateGist, GistError } from "./gist";
import { generateProjectName } from "./project-name";
import { showToast } from "./toast";

type ShareState = "idle" | "authenticating" | "sharing";

// JS にシンタックスエラーがあるかを同期的に判定する。
// new Function はコードをパース（コンパイル）するだけで実行はしないため、
// 構文エラーのみを捕捉できる（ランタイムエラーは対象外）。
// CSP の unsafe-eval 禁止などで EvalError になった場合は SyntaxError ではない
// ので false を返し、検証不能なら保存をブロックしない安全側に倒す。
function hasJsSyntaxError(code: string): boolean {
  try {
    new Function(code);
    return false;
  } catch (e) {
    return e instanceof SyntaxError;
  }
}

export class ShareButton {
  private btn: HTMLButtonElement;
  private state: ShareState = "idle";
  private getFiles: () => Files;
  private gistId: string | null = null;
  private dirty = false;
  private projectName: string;
  // 現在の Gist に保存済みのプロジェクト名。リネーム時に旧タイトルファイルを
  // 消すために覚えておく（gistId が無ければ null）。
  private savedProjectName: string | null = null;
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly AUTO_SAVE_DEBOUNCE_MS = 1500;

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

    // 起動時に保存済みトークンの有無で接続ドットを点灯/消灯する。
    void this.refreshAuth();
  }

  // 保存済み GitHub トークンの有無を見て接続ドットを更新する。
  async refreshAuth(): Promise<void> {
    const token = await getStoredToken();
    this.setConnected(Boolean(token));
  }

  private setConnected(connected: boolean): void {
    this.btn.classList.toggle("connected", connected);
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
    this.detachGist();
    this.projectName = generateProjectName();
    this.updateDirtyState();
    return this.projectName;
  }

  // 既存 Gist との関連を解除する（サンプル読み込み・新規プロジェクト時）。
  // 以降は別スケッチ扱いになり、自動更新で前の Gist を上書きしない。
  detachGist(): void {
    this.cancelAutoSave();
    this.gistId = null;
    this.savedProjectName = null;
    this.dirty = false;
    this.updateDirtyState();
  }

  // 実行のたびに呼ばれる。Gist が作成済みのときだけ、デバウンスして自動更新する。
  scheduleAutoSave(): void {
    if (this.gistId === null) return; // 未保存のプロジェクトは自動更新しない
    this.cancelAutoSave();
    this.autoSaveTimer = setTimeout(() => {
      this.autoSaveTimer = null;
      void this.autoSave();
    }, ShareButton.AUTO_SAVE_DEBOUNCE_MS);
  }

  private cancelAutoSave(): void {
    if (this.autoSaveTimer !== null) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  private async autoSave(): Promise<void> {
    // デバウンス確定時に最新状態を再評価する
    if (this.gistId === null) return; // detach された
    if (!this.dirty) return; // 前回保存から変更なし
    if (this.state !== "idle") {
      // 手動シェア等と競合中。落ち着いてから再試行する
      this.scheduleAutoSave();
      return;
    }

    const files = this.getFiles();
    // シンタックスエラーのある状態は保存しない（壊れたコードを Gist に残さない）
    if (hasJsSyntaxError(files.js)) return;

    // 未認証ならスキップ。ポップアップはユーザー操作起因でないと開けないため。
    const token = await getStoredToken();
    if (!token) return;

    this.setState("sharing");
    try {
      const description = `${this.projectName} — canvastage sketch`;
      const result = await updateGist(
        token,
        this.gistId,
        files,
        this.projectName,
        description,
        this.savedProjectName
      );
      this.gistId = result.id;
      this.savedProjectName = this.projectName;
      this.dirty = false;
      this.updateDirtyState();
    } catch (err) {
      if (err instanceof GistError && err.code === "auth") {
        await clearToken();
        this.setConnected(false);
        showToast(
          "セッションが期限切れです。再度シェアしてください。",
          "error"
        );
      }
      // network / api エラーは dirty のまま残し、次の実行で再試行する（静かに失敗）
    } finally {
      this.setState("idle");
    }
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
          this.setConnected(true);
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
          result = await updateGist(
            token,
            this.gistId,
            files,
            this.projectName,
            description,
            this.savedProjectName
          );
          showToast("Gistを更新しました！", "success", result.url);
        } else {
          showToast("Gistを作成中...", "info");
          result = await createGist(
            token,
            files,
            this.projectName,
            description
          );
          showToast("Gistを作成しました！", "success", result.url);
        }
        this.gistId = result.id;
        this.savedProjectName = this.projectName;
        this.dirty = false;
        this.updateDirtyState();
      } catch (err) {
        if (err instanceof GistError && err.code === "auth") {
          await clearToken();
          this.setConnected(false);
          showToast(
            "セッションが期限切れです。もう一度お試しください。",
            "error"
          );
        } else {
          const msg =
            err instanceof Error ? err.message : "Gistの保存に失敗しました。";
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
