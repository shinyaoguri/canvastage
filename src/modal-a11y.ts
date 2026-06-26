// モーダル/オーバーレイ共通のアクセシビリティ補助。
// Escape での閉じる・Tab のフォーカストラップ・開く前のフォーカス復帰を提供する。

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalA11yHandle {
  // モーダルを閉じる側で呼ぶ。リスナ解除と元要素へのフォーカス復帰を行う。
  release(): void;
}

// dialog 内に Escape / Tab トラップを張り、閉じたら開く前の要素へフォーカスを戻す。
// onClose は Escape 押下時に呼ばれる（呼び出し側の close 処理に委譲する）。
export function activateModalA11y(
  dialog: HTMLElement,
  onClose: () => void
): ModalA11yHandle {
  const previouslyFocused = document.activeElement as HTMLElement | null;

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;

    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>(FOCUSABLE)
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  dialog.addEventListener("keydown", onKeydown);

  return {
    release() {
      dialog.removeEventListener("keydown", onKeydown);
      previouslyFocused?.focus?.();
    },
  };
}
