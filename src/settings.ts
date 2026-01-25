import { z } from "zod";
import { openDB, DBSchema, IDBPDatabase } from "idb";

// ========================
// Zod スキーマ定義
// ========================
export const EditorSettingsSchema = z.object({
  // フォント
  fontSize: z.number().min(10).max(24).default(14),
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
  minimap: z.boolean().default(false),
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
});

// 型を自動生成
export type EditorSettings = z.infer<typeof EditorSettingsSchema>;

// デフォルト値はスキーマから自動生成
export const DEFAULT_SETTINGS: EditorSettings = EditorSettingsSchema.parse({});

// ========================
// IndexedDB (idb)
// ========================
interface CanvastageDB extends DBSchema {
  settings: {
    key: string;
    value: EditorSettings;
  };
}

const DB_NAME = "canvastage-db";
const DB_VERSION = 1;
const STORE_NAME = "settings" as const;
const SETTINGS_KEY = "editor-settings";

let dbPromise: Promise<IDBPDatabase<CanvastageDB>> | null = null;

function getDB(): Promise<IDBPDatabase<CanvastageDB>> {
  if (!dbPromise) {
    dbPromise = openDB<CanvastageDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
}

export async function loadSettings(): Promise<EditorSettings> {
  try {
    const db = await getDB();
    const saved = await db.get(STORE_NAME, SETTINGS_KEY);

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
    const db = await getDB();
    const validSettings = EditorSettingsSchema.parse(settings);
    await db.put(STORE_NAME, validSettings, SETTINGS_KEY);
  } catch (error) {
    console.error("Failed to save settings:", error);
  }
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

  root.style.setProperty(
    "--editor-line-number-opacity",
    `${settings.lineNumberOpacity}`
  );

  root.style.setProperty(
    "--editor-cursor-opacity",
    `${settings.cursorOpacity}`
  );
  root.style.setProperty("--editor-cursor-width", `${settings.cursorWidth}px`);
  root.style.setProperty("--editor-cursor-color", settings.cursorColor);
  // カーソル色のrgba計算
  const cursorHex = settings.cursorColor.replace("#", "");
  const cr = parseInt(cursorHex.substring(0, 2), 16);
  const cg = parseInt(cursorHex.substring(2, 4), 16);
  const cb = parseInt(cursorHex.substring(4, 6), 16);
  root.style.setProperty(
    "--editor-cursor-bg",
    `rgba(${cr}, ${cg}, ${cb}, ${settings.cursorOpacity})`
  );

  root.style.setProperty(
    "--editor-selection-opacity",
    `${settings.selectionOpacity}`
  );

  root.style.setProperty(
    "--editor-current-line-opacity",
    `${settings.currentLineOpacity}`
  );
  root.style.setProperty(
    "--editor-current-line-color",
    settings.currentLineColor
  );
  // 色とopacityからrgbaを計算
  const hex = settings.currentLineColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  root.style.setProperty(
    "--editor-current-line-bg",
    `rgba(${r}, ${g}, ${b}, ${settings.currentLineOpacity})`
  );

  root.style.setProperty(
    "--editor-suggest-bg-opacity",
    `${settings.suggestBackgroundOpacity}`
  );
  root.style.setProperty("--editor-suggest-blur", `${settings.suggestBlur}px`);
  root.style.setProperty(
    "--editor-suggest-text-opacity",
    `${settings.suggestTextOpacity}`
  );

  root.style.setProperty("--editor-padding", `${settings.editorPadding}px`);
}
