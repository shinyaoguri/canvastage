import type { Files } from "./preview";
import {
  parseGistId,
  fetchGist,
  isOwnGist,
  GistError,
  type GistImport,
} from "./gist";
import {
  getStoredToken,
  clearToken,
  getStoredIdentity,
  setStoredIdentity,
} from "./github-auth";
import { fetchViewerLogin } from "./github-user";
import { showToast } from "./toast";
import { activateModalA11y, type ModalA11yHandle } from "./modal-a11y";

export interface GistAttachment {
  gistId: string;
  /** Gist 上に実在するタイトルファイルのベース名（無ければ null）。 */
  savedProjectName: string | null;
  /** 所有者の login。ドラフト復元時に今のトークンの持ち主と突き合わせる。 */
  ownerLogin: string | null;
}

export interface GistImportResult {
  files: Files;
  projectName: string;
  /** 自分の Gist で、更新を継続する場合のみ非 null。 */
  attach: GistAttachment | null;
}

export type GistImportHandler = (result: GistImportResult) => void;

// 取り込んだ Gist を更新継続できるかの判定結果。トーストの文言もこれで決まる。
type AttachOutcome =
  | { kind: "attached"; attach: GistAttachment }
  | { kind: "not-owned" }
  | { kind: "anonymous" }
  | { kind: "unknown" };

// Gist から取り込むボタン + URL 入力モーダル。
// 自分の Gist を取り込んだ場合はそのまま更新を継続し、他人の Gist・未認証・
// 所有者を確認できなかった場合は新規プロジェクト扱いにする。
// モーダルは OpenProcessing モーダルの CSS（op-modal*）を流用して統一感を出す。
export class GistImportButton {
  private btn: HTMLButtonElement;
  private overlay: HTMLElement;
  private onImport: GistImportHandler | null = null;
  private busy = false;
  private a11y: ModalA11yHandle | null = null;

  constructor(container: HTMLElement) {
    this.btn = document.createElement("button");
    this.btn.id = "import-btn";
    this.btn.className = "toolbar-btn";
    this.btn.title = "Import from Gist";
    // 取り込み（ダウンロード）を直感的に伝えるアイコン。
    this.btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>`;
    this.btn.onclick = () => this.open();
    container.appendChild(this.btn);

    this.overlay = document.createElement("div");
    this.overlay.id = "import-modal-overlay";
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.close();
    });
    document.body.appendChild(this.overlay);
  }

  setOnImport(handler: GistImportHandler): void {
    this.onImport = handler;
  }

  private open(): void {
    this.overlay.innerHTML = this.buildHTML();
    this.bindEvents();
    this.overlay.classList.add("open");
    const dialog = this.overlay.querySelector<HTMLElement>(".op-modal");
    this.a11y = dialog ? activateModalA11y(dialog, () => this.close()) : null;
    this.overlay.querySelector<HTMLInputElement>("#import-url-input")?.focus();
    void this.updateNote();
  }

  // 認証状態で注記を出し分ける。open() は同期なので、まず未認証向けの文言で描画し、
  // トークンの有無が分かった時点で差し替える（ログイン名の取得までは待たない）。
  private async updateNote(): Promise<void> {
    if (!(await getStoredToken())) return;
    const note = this.overlay.querySelector<HTMLElement>("#import-note");
    if (!note) return;
    note.textContent =
      "現在開いているコードは置き換えられます。自分の Gist なら更新を継続します" +
      "（実行のたびに自動更新）。他の人の Gist は新規プロジェクト扱いです。" +
      "どちらの場合も OpenProcessing 連携は切り離されます。";
  }

  private close(): void {
    this.overlay.classList.remove("open");
    this.a11y?.release();
    this.a11y = null;
  }

  private buildHTML(): string {
    return `<div class="op-modal" role="dialog" aria-modal="true" aria-labelledby="import-modal-title">
      <div class="op-modal-header">
        <span id="import-modal-title">Gist から取り込む</span>
        <button class="op-modal-close" aria-label="閉じる">×</button>
      </div>
      <div class="op-modal-content">
        <section class="op-section">
          <p>canvastage で出力した<strong>公開 Gist</strong> の URL（または ID）を貼り付けてください。</p>
          <div class="op-token-row">
            <input type="text" id="import-url-input"
              placeholder="https://gist.github.com/&lt;user&gt;/&lt;id&gt;"
              autocomplete="off" spellcheck="false" />
            <button id="import-run" class="op-btn-primary">取り込む</button>
          </div>
          <p id="import-status" class="op-token-status"></p>
          <p class="op-note" id="import-note">
            現在開いているコードは置き換えられます。取り込んだスケッチは新規プロジェクト
            扱いになり、既存の Gist / OpenProcessing 連携とは切り離されます。
            GitHub に接続していれば、自分の Gist はそのまま更新を継続できます。
          </p>
          <p class="op-note op-note-warning">
            ⚠️ 取り込んだコードは実行時にこのアプリと同じ権限で動作します。
            信頼できる作者の Gist のみ取り込んでください。
          </p>
        </section>
      </div>
    </div>`;
  }

  private bindEvents(): void {
    this.overlay
      .querySelector(".op-modal-close")
      ?.addEventListener("click", () => this.close());

    const input =
      this.overlay.querySelector<HTMLInputElement>("#import-url-input");
    const status = this.overlay.querySelector<HTMLElement>("#import-status");

    this.overlay
      .querySelector("#import-run")
      ?.addEventListener("click", () => void this.run(input, status));
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing) void this.run(input, status);
    });
  }

  private async run(
    input: HTMLInputElement | null,
    status: HTMLElement | null
  ): Promise<void> {
    if (this.busy) return;

    const id = parseGistId(input?.value ?? "");
    if (!id) {
      this.setStatus(
        status,
        "URL または Gist ID を入力してください。",
        "op-error"
      );
      return;
    }

    this.busy = true;
    this.btn.classList.add("loading");
    this.setStatus(status, "取り込み中...", "");
    try {
      const token = await getStoredToken();
      const imported = await this.fetchWithFallback(id, token);
      const outcome = await this.resolveAttach(imported, token);
      this.onImport?.({
        files: imported.files,
        projectName: imported.projectName,
        attach: outcome.kind === "attached" ? outcome.attach : null,
      });
      this.notifyImported(imported, outcome);
      this.close();
    } catch (err) {
      const msg =
        err instanceof GistError ? err.message : "取り込みに失敗しました。";
      this.setStatus(status, msg, "op-error");
    } finally {
      this.busy = false;
      this.btn.classList.remove("loading");
    }
  }

  // トークンがあれば認証付きで取得する（secret gist が読め、レート制限も緩む）。
  // トークンが失効していた場合だけ、公開 Gist として匿名で取り直す。
  private async fetchWithFallback(
    id: string,
    token: string | null
  ): Promise<GistImport> {
    if (!token) return fetchGist(id);
    try {
      return await fetchGist(id, token);
    } catch (err) {
      if (err instanceof GistError && err.code === "auth") {
        await clearToken();
        return fetchGist(id);
      }
      throw err;
    }
  }

  // 取り込んだ Gist を更新継続してよいかを決める。
  // 所有者を確認できないケース（未認証・API 失敗・レート制限）はすべて継続しない側に
  // 倒す。誤って継続すると、他人の Gist に対して「更新中」と誤表示したまま
  // 失敗する PATCH を投げ続けることになるため。
  private async resolveAttach(
    imported: GistImport,
    token: string | null
  ): Promise<AttachOutcome> {
    if (!token) return { kind: "anonymous" };

    let myLogin = await getStoredIdentity();
    if (!myLogin) {
      try {
        myLogin = await fetchViewerLogin(token);
        await setStoredIdentity(myLogin);
      } catch {
        return { kind: "unknown" };
      }
    }
    if (!isOwnGist(imported.ownerLogin, myLogin)) return { kind: "not-owned" };
    return {
      kind: "attached",
      attach: {
        gistId: imported.gistId,
        // 表示名ではなく Gist 上の実体名を渡す（リネーム時に消すファイルの特定に使う）。
        savedProjectName: imported.titleName,
        ownerLogin: imported.ownerLogin,
      },
    };
  }

  private notifyImported(imported: GistImport, outcome: AttachOutcome): void {
    const name = imported.projectName;
    switch (outcome.kind) {
      case "attached":
        showToast(
          `「${name}」を取り込みました。この Gist の更新を継続します。`,
          "success",
          imported.htmlUrl ?? undefined
        );
        return;
      case "not-owned":
        showToast(
          `「${name}」を取り込みました（新規プロジェクト）。他の人の Gist なので更新は継続しません。`,
          "success"
        );
        return;
      case "anonymous":
        showToast(
          `「${name}」を取り込みました（新規プロジェクト）。GitHub に接続すると、自分の Gist は更新を継続できます。`,
          "success"
        );
        return;
      case "unknown":
        showToast(
          `「${name}」を取り込みました（新規プロジェクト）。所有者を確認できませんでした。`,
          "info"
        );
    }
  }

  private setStatus(el: HTMLElement | null, text: string, cls: string): void {
    if (!el) return;
    el.textContent = text;
    el.className = `op-token-status ${cls}`.trim();
  }
}
