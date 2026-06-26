import { z } from "zod";
import { createStore } from "./idb-store";

// ========================
// Zod スキーマ定義
// ========================
export const EditorSettingsSchema = z.object({
  // フォント
  fontSize: z.number().min(10).max(48).default(14),
  fontFamily: z.string().default("'M PLUS 1 Code', monospace"),
  fontWeight: z.number().min(100).max(900).default(400),
  lineHeight: z.number().min(1).max(2).default(1.5),

  // テキスト
  textOpacity: z.number().min(0).max(1).default(0.9),
  textShadowBlur: z.number().min(0).max(10).default(3),
  textShadowColor: z.string().default("#000000"),

  // 行番号
  lineNumberOpacity: z.number().min(0).max(1).default(0.3),

  // カーソル
  cursorOpacity: z.number().min(0).max(1).default(0.8),
  cursorWidth: z.number().min(1).max(4).default(2),
  cursorColor: z.string().default("#ffffff"),

  // 選択範囲
  selectionOpacity: z.number().min(0).max(0.5).default(0.15),

  // 現在行ハイライト
  currentLineOpacity: z.number().min(0).max(0.3).default(0.05),
  currentLineColor: z.string().default("#ffffff"),

  // サジェスト
  suggestBackgroundOpacity: z.number().min(0).max(1).default(0.4),
  suggestBlur: z.number().min(0).max(20).default(8),
  suggestTextOpacity: z.number().min(0).max(1).default(0.5),

  // エディタ領域
  editorPadding: z.number().min(0).max(64).default(32),

  // エディタ機能
  indentGuides: z.boolean().default(false),
  bracketPairGuides: z.boolean().default(false),
  bracketMatching: z.boolean().default(false),

  // Monaco エディタ設定
  tabSize: z.number().min(2).max(8).default(2),
  renderWhitespace: z
    .enum(["none", "boundary", "selection", "trailing", "all"])
    .default("none"),
  wordWrap: z.enum(["on", "off", "wordWrapColumn", "bounded"]).default("on"),
  smoothScrolling: z.boolean().default(true),
  cursorBlinking: z
    .enum(["blink", "smooth", "phase", "expand", "solid"])
    .default("blink"),
  cursorStyle: z
    .enum([
      "line",
      "block",
      "underline",
      "line-thin",
      "block-outline",
      "underline-thin",
    ])
    .default("line"),
  stickyScroll: z.boolean().default(false),

  // テーマ
  editorTheme: z.string().default("transparent-dark"),

  // 音声ビート可視化（有効/無効は永続化せず毎回 OFF 始動。音源/パターン/感度を保存）
  audioSource: z.enum(["mic", "tab"]).default("mic"),
  beatPattern: z.string().default("frame-flash"),
  // ビート感度（0=厳しめ / 1=緩め）。閾値スライダーとして UI に出す。
  beatSensitivity: z.number().min(0).max(1).default(0.6),
  // 検出帯域(Hz)。下限=キック/ベース寄り、上限=手拍子/スネア寄り。
  beatBandMinHz: z.number().min(20).max(500).default(30),
  beatBandMaxHz: z.number().min(500).max(8000).default(4000),
  // ノイズ床（これ未満のフラックスは無視）。
  beatFloor: z.number().min(0).max(0.03).default(0.006),
  // 連続発火を防ぐ最小間隔(ms)。
  beatMinIntervalMs: z.number().min(60).max(400).default(130),
});

// 型を自動生成
export type EditorSettings = z.infer<typeof EditorSettingsSchema>;

// デフォルト値はスキーマから自動生成
export const DEFAULT_SETTINGS: EditorSettings = EditorSettingsSchema.parse({});

// ========================
// IndexedDB
// ========================
const SETTINGS_KEY = "editor-settings";
const store = createStore<EditorSettings>("canvastage-db", "settings");

export async function loadSettings(): Promise<EditorSettings> {
  try {
    const saved = await store.get(SETTINGS_KEY);

    if (saved) {
      const result = EditorSettingsSchema.safeParse(saved);
      if (result.success) {
        return result.data;
      }
      // 部分的に有効な値を保持
      console.warn(
        "Settings validation failed, using defaults for invalid fields"
      );
      return {
        ...DEFAULT_SETTINGS,
        ...EditorSettingsSchema.partial().parse(saved),
      };
    }
    return { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: EditorSettings): Promise<void> {
  try {
    const validSettings = EditorSettingsSchema.parse(settings);
    await store.put(SETTINGS_KEY, validSettings);
  } catch (error) {
    console.error("Failed to save settings:", error);
  }
}

// `#rrggbb` と不透明度から rgba 文字列を組み立てる。
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function applySettings(settings: EditorSettings): void {
  const root = document.documentElement;

  root.style.setProperty("--editor-font-size", `${settings.fontSize}px`);
  root.style.setProperty("--editor-font-family", settings.fontFamily);
  root.style.setProperty("--editor-font-weight", `${settings.fontWeight}`);
  root.style.setProperty("--editor-line-height", `${settings.lineHeight}`);

  root.style.setProperty("--editor-text-opacity", `${settings.textOpacity}`);
  root.style.setProperty(
    "--editor-text-shadow-blur",
    `${settings.textShadowBlur}px`
  );
  root.style.setProperty(
    "--editor-text-shadow-color",
    settings.textShadowColor
  );

  // 注意: CSS ビルド時のミニファイアは `rgba(r,g,b, var(--x))` のように
  // rgba() の中に var() を入れた宣言を無効と見なして削除する。そのため
  // 不透明度を含む色は JS 側で完全な rgba 文字列に組み立て、CSS では
  // 単一の var() として参照する（cursor-bg / current-line-bg と同じ方式）。
  root.style.setProperty(
    "--editor-line-number-color",
    `rgba(255, 255, 255, ${settings.lineNumberOpacity})`
  );

  root.style.setProperty(
    "--editor-cursor-opacity",
    `${settings.cursorOpacity}`
  );
  root.style.setProperty("--editor-cursor-width", `${settings.cursorWidth}px`);
  root.style.setProperty("--editor-cursor-color", settings.cursorColor);
  root.style.setProperty(
    "--editor-cursor-bg",
    hexToRgba(settings.cursorColor, settings.cursorOpacity)
  );

  root.style.setProperty(
    "--editor-selection-bg",
    `rgba(255, 255, 255, ${settings.selectionOpacity})`
  );

  root.style.setProperty(
    "--editor-current-line-opacity",
    `${settings.currentLineOpacity}`
  );
  root.style.setProperty(
    "--editor-current-line-color",
    settings.currentLineColor
  );
  root.style.setProperty(
    "--editor-current-line-bg",
    hexToRgba(settings.currentLineColor, settings.currentLineOpacity)
  );

  root.style.setProperty(
    "--editor-suggest-bg",
    `rgba(0, 0, 0, ${settings.suggestBackgroundOpacity})`
  );
  root.style.setProperty("--editor-suggest-blur", `${settings.suggestBlur}px`);
  root.style.setProperty(
    "--editor-suggest-text-color",
    `rgba(255, 255, 255, ${settings.suggestTextOpacity})`
  );

  root.style.setProperty("--editor-padding", `${settings.editorPadding}px`);
}
