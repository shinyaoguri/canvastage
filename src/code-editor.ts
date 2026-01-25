import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import { EditorSettings } from "./settings";

// Monaco Editor Worker の設定
self.MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    if (label === "typescript" || label === "javascript") {
      return new tsWorker();
    }
    if (label === "css" || label === "scss" || label === "less") {
      return new cssWorker();
    }
    if (label === "html" || label === "handlebars" || label === "razor") {
      return new htmlWorker();
    }
    return new editorWorker();
  },
};

// カラーパレット型
interface ThemePalette {
  comment: string;
  keyword: string;
  string: string;
  number: string;
  type: string;
  function: string;
  variable: string;
  constant: string;
  foreground?: string;
  lineHighlight?: string;
}

// パレットからテーマデータを生成
function createTheme(palette: ThemePalette): monaco.editor.IStandaloneThemeData {
  return {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: palette.comment, fontStyle: "italic" },
      { token: "keyword", foreground: palette.keyword },
      { token: "string", foreground: palette.string },
      { token: "number", foreground: palette.number },
      { token: "type", foreground: palette.type, fontStyle: "italic" },
      { token: "function", foreground: palette.function },
      { token: "variable", foreground: palette.variable },
      { token: "constant", foreground: palette.constant },
    ],
    colors: {
      "editor.background": "#00000000",
      "editor.foreground": `#${palette.foreground ?? "F8F8F2"}`,
      "editor.lineHighlightBackground": palette.lineHighlight ?? "#ffffff08",
      "editor.lineHighlightBorder": "#00000000",
    },
  };
}

// カラーパレット定義
const PALETTES: Record<string, ThemePalette> = {
  monokai: {
    comment: "75715E", keyword: "F92672", string: "E6DB74", number: "AE81FF",
    type: "66D9EF", function: "A6E22E", variable: "F8F8F2", constant: "AE81FF",
  },
  dracula: {
    comment: "6272A4", keyword: "FF79C6", string: "F1FA8C", number: "BD93F9",
    type: "8BE9FD", function: "50FA7B", variable: "F8F8F2", constant: "BD93F9",
  },
  "github-dark": {
    comment: "8B949E", keyword: "FF7B72", string: "A5D6FF", number: "79C0FF",
    type: "FFA657", function: "D2A8FF", variable: "C9D1D9", constant: "79C0FF",
    foreground: "C9D1D9",
  },
  nord: {
    comment: "616E88", keyword: "81A1C1", string: "A3BE8C", number: "B48EAD",
    type: "8FBCBB", function: "88C0D0", variable: "D8DEE9", constant: "B48EAD",
    foreground: "D8DEE9",
  },
  solarized: {
    comment: "586E75", keyword: "859900", string: "2AA198", number: "D33682",
    type: "B58900", function: "268BD2", variable: "839496", constant: "CB4B16",
    foreground: "839496",
  },
  "one-dark": {
    comment: "5C6370", keyword: "C678DD", string: "98C379", number: "D19A66",
    type: "E5C07B", function: "61AFEF", variable: "E06C75", constant: "D19A66",
    foreground: "ABB2BF",
  },
  cyberpunk: {
    comment: "6A6A8E", keyword: "FF2A6D", string: "05D9E8", number: "D1F7FF",
    type: "FF6AC1", function: "01FFC3", variable: "FCEE0A", constant: "FF9F1C",
    foreground: "D1F7FF", lineHighlight: "#ff2a6d10",
  },
};

// デフォルトテーマ（ルールなし、継承のみ）
const DEFAULT_THEME: monaco.editor.IStandaloneThemeData = {
  base: "vs-dark",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#00000000",
    "editor.lineHighlightBackground": "#ffffff08",
    "editor.lineHighlightBorder": "#00000000",
  },
};

// テーマを登録
function registerThemes(): void {
  // デフォルトテーマ
  monaco.editor.defineTheme("transparent-dark", DEFAULT_THEME);
  // パレットベースのテーマ
  for (const [name, palette] of Object.entries(PALETTES)) {
    monaco.editor.defineTheme(name, createTheme(palette));
  }
}

registerThemes();

export interface Editor {
  getValue(): string;
  setValue(value: string): void;
  setLanguage(language: string): void;
  setTheme(theme: string): void;
  applySettings(settings: EditorSettings): void;
}

export function createEditor(
  container: HTMLElement,
  initialValue: string,
  initialLanguage: string,
  onRun: () => void,
  initialSettings?: EditorSettings
): Editor {
  const editor = monaco.editor.create(container, {
    value: initialValue,
    language: initialLanguage,
    theme: initialSettings?.editorTheme ?? "transparent-dark",
    fontSize: initialSettings?.fontSize ?? 14,
    fontFamily: initialSettings?.fontFamily ?? "'JetBrains Mono', monospace",
    fontWeight: String(initialSettings?.fontWeight ?? 400),
    lineHeight: initialSettings?.lineHeight ? initialSettings.lineHeight * (initialSettings?.fontSize ?? 14) : undefined,
    lineNumbers: "on",
    lineNumbersMinChars: 3,
    minimap: { enabled: initialSettings?.minimap ?? false },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: initialSettings?.tabSize ?? 2,
    wordWrap: initialSettings?.wordWrap ?? "on",
    suggestOnTriggerCharacters: true,
    quickSuggestions: true,
    acceptSuggestionOnEnter: "on",
    padding: { top: 12, bottom: 12 },
    renderLineHighlight: "all",
    renderLineHighlightOnlyWhenFocus: false,
    occurrencesHighlight: "off",
    selectionHighlight: false,
    renderWhitespace: initialSettings?.renderWhitespace ?? "none",
    smoothScrolling: initialSettings?.smoothScrolling ?? true,
    cursorBlinking: initialSettings?.cursorBlinking ?? "blink",
    cursorStyle: initialSettings?.cursorStyle ?? "line",
    stickyScroll: { enabled: initialSettings?.stickyScroll ?? false },
    folding: false,
    glyphMargin: false,
    lineDecorationsWidth: 10,
    guides: {
      indentation: initialSettings?.indentGuides ?? false,
      bracketPairs: initialSettings?.bracketPairGuides ?? false,
      highlightActiveIndentation: initialSettings?.indentGuides ?? false,
      highlightActiveBracketPair: initialSettings?.bracketPairGuides ?? false,
    },
    bracketPairColorization: {
      enabled: initialSettings?.bracketPairGuides ?? false,
    },
    overviewRulerLanes: 0,
    hideCursorInOverviewRuler: true,
    overviewRulerBorder: false,
    matchBrackets: initialSettings?.bracketMatching ? "always" : "never",
    scrollbar: {
      vertical: "hidden",
      horizontal: "hidden",
    },
    contextmenu: false,
  });

  // Ctrl+Enter で実行
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, onRun);

  return {
    getValue: () => editor.getValue(),
    setValue: (value: string) => editor.setValue(value),
    setLanguage: (language: string) => {
      monaco.editor.setModelLanguage(editor.getModel()!, language);
    },
    setTheme: (theme: string) => {
      monaco.editor.setTheme(theme);
    },
    applySettings: (settings: EditorSettings) => {
      monaco.editor.setTheme(settings.editorTheme);

      // モデルのtabSizeを更新
      const model = editor.getModel();
      if (model) {
        model.updateOptions({ tabSize: settings.tabSize });
      }

      editor.updateOptions({
        fontSize: settings.fontSize,
        fontFamily: settings.fontFamily,
        fontWeight: String(settings.fontWeight),
        lineHeight: settings.lineHeight * settings.fontSize,
        tabSize: settings.tabSize,
        renderWhitespace: settings.renderWhitespace,
        wordWrap: settings.wordWrap,
        minimap: { enabled: settings.minimap },
        smoothScrolling: settings.smoothScrolling,
        cursorBlinking: settings.cursorBlinking,
        cursorStyle: settings.cursorStyle,
        stickyScroll: { enabled: settings.stickyScroll },
        guides: {
          indentation: settings.indentGuides,
          bracketPairs: settings.bracketPairGuides,
          highlightActiveIndentation: settings.indentGuides,
          highlightActiveBracketPair: settings.bracketPairGuides,
        },
        bracketPairColorization: {
          enabled: settings.bracketPairGuides,
        },
        matchBrackets: settings.bracketMatching ? "always" : "never",
      });
    },
  };
}
