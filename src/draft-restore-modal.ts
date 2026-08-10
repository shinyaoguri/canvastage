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
/**
 * 実行時にキャプチャした見た目。撮れていないスケッチ（canvas を持たない、
 * WebGL でバッファが読めない、一度も実行していない）はコードの抜粋で代用する。
 */
function makeThumbnail(
  dataUrl: string | null,
  codePreview: string
): HTMLElement {
  const box = document.createElement("div");
  box.className = "draft-item-thumb";

  // dataUrl は自分のプレビューを canvas.toDataURL したものだけが入る。
  // 念のため、data: 以外を src に渡さない。
  if (dataUrl && dataUrl.startsWith("data:image/")) {
    const img = document.createElement("img");
    img.src = dataUrl;
    img.alt = "";
    img.decoding = "async";
    box.appendChild(img);
    return box;
  }

  box.classList.add("draft-item-thumb-code");
  const code = document.createElement("pre");
  // コードはユーザー入力なので必ず textContent で入れる。
  code.textContent = codePreview || "（プレビューなし）";
  box.appendChild(code);
  return box;
}

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
          <button id="draft-restore-new" class="draft-new-btn" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            <span>新規プロジェクトで始める</span>
          </button>
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
      const { name, meta, codePreview } = summarizeDraft(draft, now);
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

      const body = document.createElement("div");
      body.className = "draft-item-body";
      body.append(nameEl, metaEl);

      item.append(makeThumbnail(draft.thumbnail, codePreview), body);
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
