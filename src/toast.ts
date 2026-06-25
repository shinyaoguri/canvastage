// アプリ共通のトースト通知。以前は share.ts に同居していたが、gist-import /
// openprocessing-* など ShareButton と無関係なモジュールからも使うため独立させた。

let toastContainer: HTMLElement | null = null;

function getToastContainer(): HTMLElement {
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toast-container";
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function showToast(
  message: string,
  type: "info" | "success" | "error",
  url?: string
): void {
  const container = getToastContainer();
  container.innerHTML = "";

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const msgSpan = document.createElement("span");
  msgSpan.className = "toast-message";
  msgSpan.textContent = message;
  toast.appendChild(msgSpan);

  if (url) {
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
      navigator.clipboard
        .writeText(url)
        .then(() => {
          copyBtn.title = "コピーしました！";
        })
        .catch(() => {
          copyBtn.title = "コピーに失敗しました";
        });
    });
    toast.appendChild(copyBtn);
  }

  container.appendChild(toast);

  const duration = url ? 8000 : 4000;
  setTimeout(() => {
    toast.classList.add("toast-exit");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
