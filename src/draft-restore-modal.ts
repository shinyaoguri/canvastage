import { activateModalA11y, type ModalA11yHandle } from "./modal-a11y";
import { summarizeDraft } from "./drafts/draft-selection";
import type { DraftRecord } from "./drafts/draft-types";

export type DraftRestoreChoice =
  { kind: "restore"; draft: DraftRecord } | { kind: "new" };

// 起動時に「前回の続き」を選ばせるモーダル。
// 構造とスタイルは Gist 取り込みモーダル（op-modal*）に合わせている。
//
// 取り込みモーダルと違い、背景クリックでは閉じない。誤クリックで意図せず
// 「新規で始める」に倒れると、前回の続きが目の前から消えたように見えるため。
// Escape は「新規で始める」に割り当てる（ドラフトは削除されないので非破壊）。
export function promptDraftRestore(
  candidates: DraftRecord[]
): Promise<DraftRestoreChoice> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.id = "draft-restore-overlay";
    overlay.innerHTML = `<div class="op-modal" role="dialog" aria-modal="true" aria-labelledby="draft-restore-title">
      <div class="op-modal-header">
        <span id="draft-restore-title">前回の続きから始めますか？</span>
      </div>
      <div class="op-modal-content">
        <section class="op-section">
          <p>48時間以内に編集したスケッチが見つかりました。他のタブで開いているものは除外しています。</p>
          <div class="draft-list" id="draft-list" role="list"></div>
          <button id="draft-restore-new" class="op-btn-text">新規で始める</button>
          <p class="op-note">開かなかったスケッチも48時間は残ります。</p>
        </section>
      </div>
    </div>`;

    let a11y: ModalA11yHandle | null = null;
    const finish = (choice: DraftRestoreChoice) => {
      overlay.classList.remove("open");
      a11y?.release();
      a11y = null;
      overlay.remove();
      resolve(choice);
    };

    const list = overlay.querySelector<HTMLElement>("#draft-list")!;
    const now = Date.now();
    for (const draft of candidates) {
      // プロジェクト名はユーザー入力なので、innerHTML には一切埋め込まず
      // textContent で流す（samples-panel は静的な定数名なのでそうしていない）。
      const { name, meta } = summarizeDraft(draft, now);
      const item = document.createElement("button");
      item.className = "samples-item draft-item";
      item.setAttribute("role", "listitem");
      item.dataset.draftId = draft.id;

      const nameEl = document.createElement("div");
      nameEl.className = "samples-item-name";
      nameEl.textContent = name;
      const metaEl = document.createElement("div");
      metaEl.className = "samples-item-desc";
      metaEl.textContent = meta;

      item.append(nameEl, metaEl);
      item.addEventListener("click", () => finish({ kind: "restore", draft }));
      list.appendChild(item);
    }

    overlay
      .querySelector("#draft-restore-new")
      ?.addEventListener("click", () => finish({ kind: "new" }));

    document.body.appendChild(overlay);
    overlay.classList.add("open");
    const dialog = overlay.querySelector<HTMLElement>(".op-modal");
    a11y = dialog
      ? activateModalA11y(dialog, () => finish({ kind: "new" }))
      : null;
    list.querySelector<HTMLElement>(".draft-item")?.focus();
  });
}
