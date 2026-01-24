export interface EditorSettings {
  // フォント
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  lineHeight: number;

  // テキスト
  textOpacity: number;
  textShadowBlur: number;
  textShadowColor: string;

  // 行番号
  lineNumberOpacity: number;

  // カーソル
  cursorOpacity: number;
  cursorWidth: number;
  cursorColor: string;

  // 選択範囲
  selectionOpacity: number;

  // 現在行ハイライト
  currentLineOpacity: number;
  currentLineColor: string;

  // サジェスト
  suggestBackgroundOpacity: number;
  suggestBlur: number;
  suggestTextOpacity: number;

  // エディタ領域
  editorPadding: number;

  // エディタ機能
  indentGuides: boolean;
  bracketPairGuides: boolean;
  bracketMatching: boolean;

  // Monaco エディタ設定
  tabSize: number;
  renderWhitespace: "none" | "boundary" | "selection" | "trailing" | "all";
  wordWrap: "on" | "off" | "wordWrapColumn" | "bounded";
  minimap: boolean;
  smoothScrolling: boolean;
  cursorBlinking: "blink" | "smooth" | "phase" | "expand" | "solid";
  cursorStyle: "line" | "block" | "underline" | "line-thin" | "block-outline" | "underline-thin";
  stickyScroll: boolean;

  // テーマ
  editorTheme: string;
}

export const DEFAULT_SETTINGS: EditorSettings = {
  fontSize: 14,
  fontFamily: "'M PLUS 1 Code', monospace",
  fontWeight: 400,
  lineHeight: 1.5,

  textOpacity: 0.9,
  textShadowBlur: 3,
  textShadowColor: "#000000",

  lineNumberOpacity: 0.3,

  cursorOpacity: 0.8,
  cursorWidth: 2,
  cursorColor: "#ffffff",

  selectionOpacity: 0.15,

  currentLineOpacity: 0.05,
  currentLineColor: "#ffffff",

  suggestBackgroundOpacity: 0.4,
  suggestBlur: 8,
  suggestTextOpacity: 0.5,

  editorPadding: 32,

  indentGuides: false,
  bracketPairGuides: false,
  bracketMatching: false,

  tabSize: 2,
  renderWhitespace: "none",
  wordWrap: "on",
  minimap: false,
  smoothScrolling: true,
  cursorBlinking: "blink",
  cursorStyle: "line",
  stickyScroll: false,

  editorTheme: "transparent-dark",
};

const STORAGE_KEY = "canvastage-settings";

export function loadSettings(): EditorSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: EditorSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function applySettings(settings: EditorSettings): void {
  const root = document.documentElement;

  root.style.setProperty("--editor-font-size", `${settings.fontSize}px`);
  root.style.setProperty("--editor-font-family", settings.fontFamily);
  root.style.setProperty("--editor-font-weight", `${settings.fontWeight}`);
  root.style.setProperty("--editor-line-height", `${settings.lineHeight}`);

  root.style.setProperty("--editor-text-opacity", `${settings.textOpacity}`);
  root.style.setProperty("--editor-text-shadow-blur", `${settings.textShadowBlur}px`);
  root.style.setProperty("--editor-text-shadow-color", settings.textShadowColor);

  root.style.setProperty("--editor-line-number-opacity", `${settings.lineNumberOpacity}`);

  root.style.setProperty("--editor-cursor-opacity", `${settings.cursorOpacity}`);
  root.style.setProperty("--editor-cursor-width", `${settings.cursorWidth}px`);
  root.style.setProperty("--editor-cursor-color", settings.cursorColor);
  // カーソル色のrgba計算
  const cursorHex = settings.cursorColor.replace("#", "");
  const cr = parseInt(cursorHex.substring(0, 2), 16);
  const cg = parseInt(cursorHex.substring(2, 4), 16);
  const cb = parseInt(cursorHex.substring(4, 6), 16);
  root.style.setProperty("--editor-cursor-bg", `rgba(${cr}, ${cg}, ${cb}, ${settings.cursorOpacity})`);

  root.style.setProperty("--editor-selection-opacity", `${settings.selectionOpacity}`);

  root.style.setProperty("--editor-current-line-opacity", `${settings.currentLineOpacity}`);
  root.style.setProperty("--editor-current-line-color", settings.currentLineColor);
  // 色とopacityからrgbaを計算
  const hex = settings.currentLineColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  root.style.setProperty("--editor-current-line-bg", `rgba(${r}, ${g}, ${b}, ${settings.currentLineOpacity})`);

  root.style.setProperty("--editor-suggest-bg-opacity", `${settings.suggestBackgroundOpacity}`);
  root.style.setProperty("--editor-suggest-blur", `${settings.suggestBlur}px`);
  root.style.setProperty("--editor-suggest-text-opacity", `${settings.suggestTextOpacity}`);

  root.style.setProperty("--editor-padding", `${settings.editorPadding}px`);
}
