import type { Files } from "./preview";
import { whoami, OpenProcessingError } from "./openprocessing";
import { getStoredToken, storeToken, clearToken } from "./openprocessing-auth";
import { showToast } from "./share";

const TOKEN_PAGE = "https://openprocessing.org/user/#edit";
const CREATE_PAGE = "https://openprocessing.org/sketch/create";

export interface OpenProcessingModalDeps {
  // コピー用に最新のファイル内容を取得する。
  getFiles: () => Files;
  // トークン保存＋write権限確認に成功したら呼ばれる（デプロイ再試行用）。
  onConnected: () => void;
  // トークンの保存/削除のたびに呼ばれる（接続ドット更新用）。
  onAuthChanged: () => void;
}

// OpenProcessing 連携モーダル。
// - Plus+ ユーザー: API トークンを貼って接続 → 以降ボタン1発でデプロイ
// - 無料ユーザー: 手動アップロード手順（コードのコピー＋作成ページ誘導）
export class OpenProcessingModal {
  private overlay: HTMLElement;
  private deps: OpenProcessingModalDeps;

  constructor(deps: OpenProcessingModalDeps) {
    this.deps = deps;
    this.overlay = document.createElement("div");
    this.overlay.id = "op-modal-overlay";
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.close();
    });
    document.body.appendChild(this.overlay);
  }

  async open(): Promise<void> {
    const token = await getStoredToken();
    this.overlay.innerHTML = this.buildHTML(Boolean(token));
    this.bindEvents();
    this.overlay.classList.add("open");
  }

  close(): void {
    this.overlay.classList.remove("open");
  }

  private buildHTML(hasToken: boolean): string {
    return `<div class="op-modal">
      <div class="op-modal-header">
        <span>OpenProcessing にデプロイ</span>
        <button class="op-modal-close" aria-label="閉じる">×</button>
      </div>
      <div class="op-modal-content">
        <section class="op-section">
          <h3>Plus+ 会員：API で直接デプロイ</h3>
          <p>
            OpenProcessing の API トークンを一度だけ登録すると、以降はボタン1つで
            あなたのアカウントにスケッチを作成・更新できます。
            <strong>書き込みには Plus+ 会員の write 権限トークンが必要です。</strong>
          </p>
          <p>
            デプロイしたスケッチは <strong>非公開（Private）</strong> で作成されます。
            一般公開したい場合は OpenProcessing 側のスケッチ設定で変更してください。
          </p>
          <p>
            <a href="${TOKEN_PAGE}" target="_blank" rel="noopener noreferrer">
              アカウント設定でトークンを発行 ↗
            </a>
          </p>
          <div class="op-token-row">
            <input type="password" id="op-token-input" placeholder="API トークンを貼り付け"
              autocomplete="off" spellcheck="false" />
            <button id="op-token-save" class="op-btn-primary">接続</button>
          </div>
          <p id="op-token-status" class="op-token-status"></p>
          ${
            hasToken
              ? `<button id="op-token-clear" class="op-btn-text">保存済みトークンを削除</button>`
              : ""
          }
          <p class="op-note">
            ⚠ トークンはこのブラウザ内（IndexedDB）にのみ保存されます。write トークンは
            あなたの全スケッチを操作できる強い権限です。共有 PC では使用後に削除してください。
          </p>
        </section>

        <hr class="op-divider" />

        <section class="op-section">
          <h3>無料アカウント：手動でアップロード</h3>
          <p>
            API での直接デプロイは Plus+ 限定ですが、コードをコピーして OpenProcessing
            のサイトに手で貼れば誰でも公開できます。
          </p>
          <ol class="op-steps">
            <li>下のボタンで各ファイルをコピー</li>
            <li><a href="${CREATE_PAGE}" target="_blank" rel="noopener noreferrer">新規スケッチを作成 ↗</a> し、<strong>HTML モード</strong>に切り替え</li>
            <li><code>index.html</code> / <code>style.css</code> / <code>sketch.js</code> の各タブに貼り付け</li>
            <li>Run で確認して Save</li>
          </ol>
          <div class="op-copy-row">
            <button class="op-copy" data-file="html">index.html をコピー</button>
            <button class="op-copy" data-file="css">style.css をコピー</button>
            <button class="op-copy" data-file="js">sketch.js をコピー</button>
          </div>
        </section>
      </div>
    </div>`;
  }

  private bindEvents(): void {
    this.overlay
      .querySelector(".op-modal-close")
      ?.addEventListener("click", () => this.close());

    const input =
      this.overlay.querySelector<HTMLInputElement>("#op-token-input");
    const status = this.overlay.querySelector<HTMLElement>("#op-token-status");

    this.overlay
      .querySelector("#op-token-save")
      ?.addEventListener("click", () => {
        void this.saveToken(input, status);
      });
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") void this.saveToken(input, status);
    });

    this.overlay
      .querySelector("#op-token-clear")
      ?.addEventListener("click", () => {
        void clearToken().then(() => {
          this.deps.onAuthChanged();
          showToast("トークンを削除しました。", "info");
          void this.open(); // 再描画（削除ボタンを消す）
        });
      });

    this.overlay
      .querySelectorAll<HTMLButtonElement>(".op-copy")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const file = btn.dataset.file as keyof Files;
          const content = this.deps.getFiles()[file];
          void navigator.clipboard.writeText(content).then(() => {
            const original = btn.textContent;
            btn.textContent = "コピーしました ✓";
            setTimeout(() => {
              btn.textContent = original;
            }, 1500);
          });
        });
      });
  }

  private async saveToken(
    input: HTMLInputElement | null,
    status: HTMLElement | null
  ): Promise<void> {
    const token = input?.value.trim();
    if (!token) return;
    if (status) {
      status.textContent = "確認中...";
      status.className = "op-token-status";
    }
    try {
      const me = await whoami(token);
      if (!me.canWrite) {
        if (status) {
          status.textContent =
            "このトークンには write 権限がありません（Plus+ の write トークンが必要です）。下の手動アップロードをご利用ください。";
          status.className = "op-token-status op-error";
        }
        return;
      }
      await storeToken(token);
      this.deps.onAuthChanged();
      if (status) {
        status.textContent = `接続しました：${me.username ?? "OpenProcessing"} ✓`;
        status.className = "op-token-status op-success";
      }
      showToast("OpenProcessing に接続しました！", "success");
      this.close();
      this.deps.onConnected();
    } catch (err) {
      const msg =
        err instanceof OpenProcessingError
          ? err.message
          : "トークンの確認に失敗しました。";
      if (status) {
        status.textContent = msg;
        status.className = "op-token-status op-error";
      }
    }
  }
}
