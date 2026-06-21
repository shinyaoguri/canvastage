import type { Files } from "./preview";
import { deploySketch, whoami, OpenProcessingError } from "./openprocessing";
import { getStoredToken } from "./openprocessing-auth";
import { OpenProcessingModal } from "./openprocessing-modal";
import { showToast } from "./share";

type State = "idle" | "deploying";

// OpenProcessing 専用デプロイボタン。GitHub(Gist) とは独立。
// クリック時の分岐:
//   トークン無 → モーダル（トークン登録 or 手動アップロード手順）
//   トークン有 + write権限無 → モーダル（手動アップロード手順）
//   トークン有 + write権限有 → 直接デプロイ（作成 or 更新）
export class OpenProcessingButton {
  private btn: HTMLButtonElement;
  private state: State = "idle";
  private getFiles: () => Files;
  private getProjectName: () => string;
  private modal: OpenProcessingModal;
  private sketchId: number | null = null;
  // デプロイ済み内容から変更があるか。デプロイ後の編集で true になる。
  private dirty = false;

  constructor(
    container: HTMLElement,
    getFiles: () => Files,
    getProjectName: () => string
  ) {
    this.getFiles = getFiles;
    this.getProjectName = getProjectName;
    this.modal = new OpenProcessingModal({
      getFiles,
      onConnected: () => void this.deploy(),
    });

    this.btn = document.createElement("button");
    this.btn.id = "openprocessing-btn";
    this.btn.className = "toolbar-btn";
    this.btn.title = "Deploy to OpenProcessing";
    // OpenProcessing を想起させる軌道（二重円）アイコン。
    this.btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="9"/>
      <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none"/>
    </svg>`;
    this.btn.onclick = () => void this.handleClick();
    container.appendChild(this.btn);
  }

  // エディタ編集時に呼ばれる。デプロイ済みなら「未デプロイの変更あり」を示す。
  markDirty(): void {
    if (!this.dirty) {
      this.dirty = true;
      this.updateState();
    }
  }

  // 別スケッチ（新規/サンプル読込）に切り替えたら連携を解除する。
  detach(): void {
    this.sketchId = null;
    this.dirty = false;
    this.updateState();
  }

  // ボタンの見た目で 3 状態を表す:
  //   未デプロイ        → 無印
  //   最新がデプロイ済み → saved（緑）
  //   デプロイ後に編集   → dirty（黄色い丸）
  private updateState(): void {
    const deployed = this.sketchId !== null;
    this.btn.classList.toggle("saved", deployed && !this.dirty);
    this.btn.classList.toggle("dirty", deployed && this.dirty);
  }

  private async handleClick(): Promise<void> {
    if (this.state !== "idle") return;

    const token = await getStoredToken();
    if (!token) {
      void this.modal.open();
      return;
    }

    // 権限確認。read-only トークンなら手動アップロード導線へ。
    try {
      const me = await whoami(token);
      if (!me.canWrite) {
        showToast(
          "このトークンには write 権限がありません。手動アップロードをご利用ください。",
          "info"
        );
        void this.modal.open();
        return;
      }
    } catch {
      // whoami 失敗時はモーダルで再入力を促す
      void this.modal.open();
      return;
    }

    void this.deploy();
  }

  private async deploy(): Promise<void> {
    if (this.state !== "idle") return;
    const token = await getStoredToken();
    if (!token) {
      void this.modal.open();
      return;
    }

    this.setState("deploying");
    const isCreate = this.sketchId === null;
    showToast(
      isCreate ? "OpenProcessing に作成中..." : "OpenProcessing を更新中...",
      "info"
    );
    try {
      const ref = await deploySketch(
        token,
        this.getFiles(),
        { title: this.getProjectName(), isPrivate: true },
        this.sketchId,
        // 作成直後に id を保持。途中で失敗しても再試行は更新になり、
        // 空スケッチを量産しない。
        (id) => {
          this.sketchId = id;
        }
      );
      this.sketchId = ref.id;
      this.dirty = false;
      this.updateState();
      showToast(
        isCreate
          ? "OpenProcessing に作成しました！"
          : "OpenProcessing を更新しました！",
        "success",
        ref.url
      );
    } catch (err) {
      if (err instanceof OpenProcessingError && err.code === "forbidden") {
        showToast(
          "書き込み権限がありません（Plus+ の write トークンが必要です）。",
          "error"
        );
        void this.modal.open();
      } else {
        const msg =
          err instanceof Error
            ? err.message
            : "OpenProcessing への保存に失敗しました。";
        showToast(msg, "error");
      }
    } finally {
      this.setState("idle");
    }
  }

  private setState(state: State): void {
    this.state = state;
    this.btn.classList.toggle("loading", state !== "idle");
  }
}
