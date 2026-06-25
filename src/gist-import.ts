import type { Files } from "./preview";
import { parseGistId, fetchGist, GistError } from "./gist";
import { showToast } from "./toast";

export type GistImportHandler = (files: Files, projectName: string) => void;

// Gist から取り込むボタン + URL 入力モーダル。
// 公開 Gist を匿名取得し、内容とプロジェクト名を呼び出し側へ渡す（連携はしない）。
// モーダルは OpenProcessing モーダルの CSS（op-modal*）を流用して統一感を出す。
export class GistImportButton {
  private btn: HTMLButtonElement;
  private overlay: HTMLElement;
  private onImport: GistImportHandler | null = null;
  private busy = false;

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
    this.overlay.querySelector<HTMLInputElement>("#import-url-input")?.focus();
  }

  private close(): void {
    this.overlay.classList.remove("open");
  }

  private buildHTML(): string {
    return `<div class="op-modal">
      <div class="op-modal-header">
        <span>Gist から取り込む</span>
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
          <p class="op-note">
            現在開いているコードは置き換えられます。取り込んだスケッチは新規プロジェクト
            扱いになり、既存の Gist / OpenProcessing 連携とは切り離されます。
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
      if (e.key === "Enter") void this.run(input, status);
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
      const { files, projectName } = await fetchGist(id);
      this.onImport?.(files, projectName);
      showToast(`「${projectName}」を取り込みました！`, "success");
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

  private setStatus(el: HTMLElement | null, text: string, cls: string): void {
    if (!el) return;
    el.textContent = text;
    el.className = `op-token-status ${cls}`.trim();
  }
}
