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

// カスタムテーマ定義
const THEMES: Record<string, monaco.editor.IStandaloneThemeData> = {
  "transparent-dark": {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#00000000",
      "editor.lineHighlightBackground": "#ffffff08",
      "editor.lineHighlightBorder": "#00000000",
    },
  },
  "monokai": {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "75715E", fontStyle: "italic" },
      { token: "keyword", foreground: "F92672" },
      { token: "string", foreground: "E6DB74" },
      { token: "number", foreground: "AE81FF" },
      { token: "type", foreground: "66D9EF", fontStyle: "italic" },
      { token: "function", foreground: "A6E22E" },
      { token: "variable", foreground: "F8F8F2" },
      { token: "constant", foreground: "AE81FF" },
    ],
    colors: {
      "editor.background": "#00000000",
      "editor.foreground": "#F8F8F2",
      "editor.lineHighlightBackground": "#ffffff08",
      "editor.lineHighlightBorder": "#00000000",
    },
  },
  "dracula": {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6272A4", fontStyle: "italic" },
      { token: "keyword", foreground: "FF79C6" },
      { token: "string", foreground: "F1FA8C" },
      { token: "number", foreground: "BD93F9" },
      { token: "type", foreground: "8BE9FD", fontStyle: "italic" },
      { token: "function", foreground: "50FA7B" },
      { token: "variable", foreground: "F8F8F2" },
      { token: "constant", foreground: "BD93F9" },
    ],
    colors: {
      "editor.background": "#00000000",
      "editor.foreground": "#F8F8F2",
      "editor.lineHighlightBackground": "#ffffff08",
      "editor.lineHighlightBorder": "#00000000",
    },
  },
  "github-dark": {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "8B949E", fontStyle: "italic" },
      { token: "keyword", foreground: "FF7B72" },
      { token: "string", foreground: "A5D6FF" },
      { token: "number", foreground: "79C0FF" },
      { token: "type", foreground: "FFA657" },
      { token: "function", foreground: "D2A8FF" },
      { token: "variable", foreground: "C9D1D9" },
      { token: "constant", foreground: "79C0FF" },
    ],
    colors: {
      "editor.background": "#00000000",
      "editor.foreground": "#C9D1D9",
      "editor.lineHighlightBackground": "#ffffff08",
      "editor.lineHighlightBorder": "#00000000",
    },
  },
  "nord": {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "616E88", fontStyle: "italic" },
      { token: "keyword", foreground: "81A1C1" },
      { token: "string", foreground: "A3BE8C" },
      { token: "number", foreground: "B48EAD" },
      { token: "type", foreground: "8FBCBB" },
      { token: "function", foreground: "88C0D0" },
      { token: "variable", foreground: "D8DEE9" },
      { token: "constant", foreground: "B48EAD" },
    ],
    colors: {
      "editor.background": "#00000000",
      "editor.foreground": "#D8DEE9",
      "editor.lineHighlightBackground": "#ffffff08",
      "editor.lineHighlightBorder": "#00000000",
    },
  },
  "solarized": {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "586E75", fontStyle: "italic" },
      { token: "keyword", foreground: "859900" },
      { token: "string", foreground: "2AA198" },
      { token: "number", foreground: "D33682" },
      { token: "type", foreground: "B58900" },
      { token: "function", foreground: "268BD2" },
      { token: "variable", foreground: "839496" },
      { token: "constant", foreground: "CB4B16" },
    ],
    colors: {
      "editor.background": "#00000000",
      "editor.foreground": "#839496",
      "editor.lineHighlightBackground": "#ffffff08",
      "editor.lineHighlightBorder": "#00000000",
    },
  },
  "one-dark": {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "5C6370", fontStyle: "italic" },
      { token: "keyword", foreground: "C678DD" },
      { token: "string", foreground: "98C379" },
      { token: "number", foreground: "D19A66" },
      { token: "type", foreground: "E5C07B" },
      { token: "function", foreground: "61AFEF" },
      { token: "variable", foreground: "E06C75" },
      { token: "constant", foreground: "D19A66" },
    ],
    colors: {
      "editor.background": "#00000000",
      "editor.foreground": "#ABB2BF",
      "editor.lineHighlightBackground": "#ffffff08",
      "editor.lineHighlightBorder": "#00000000",
    },
  },
  "cyberpunk": {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6A6A8E", fontStyle: "italic" },
      { token: "keyword", foreground: "FF2A6D" },
      { token: "string", foreground: "05D9E8" },
      { token: "number", foreground: "D1F7FF" },
      { token: "type", foreground: "FF6AC1" },
      { token: "function", foreground: "01FFC3" },
      { token: "variable", foreground: "FCEE0A" },
      { token: "constant", foreground: "FF9F1C" },
    ],
    colors: {
      "editor.background": "#00000000",
      "editor.foreground": "#D1F7FF",
      "editor.lineHighlightBackground": "#ff2a6d10",
      "editor.lineHighlightBorder": "#00000000",
    },
  },
};

// テーマを登録
function registerThemes(): void {
  for (const [name, theme] of Object.entries(THEMES)) {
    monaco.editor.defineTheme(name, theme);
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
