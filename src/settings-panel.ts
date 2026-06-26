import {
  EditorSettings,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  applySettings,
} from "./settings";
import { clearToken as clearGithubToken } from "./github-auth";
import { clearToken as clearOpenProcessingToken } from "./openprocessing-auth";
import { PATTERN_OPTIONS } from "./audio/beat-patterns";
import { supportsTabAudio } from "./audio/audio-engine";
import { TRANSITION_OPTIONS } from "./transitions";

// タブ音声は Chromium 系のみ対応。非対応環境では選択肢から外す（フールプルーフ）。
const AUDIO_SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: "mic", label: "Mic" },
  ...(supportsTabAudio() ? [{ value: "tab", label: "Tab audio" }] : []),
];

interface SettingDef {
  key: keyof EditorSettings;
  label: string;
  type: "range" | "text" | "color" | "select" | "checkbox";
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
}

interface SettingGroup {
  title: string;
  settings: SettingDef[];
  // 特殊セクション識別子。"audio" のときは有効化トグル+ステータスを差し込む。
  id?: string;
  // true のときアコーディオン（折りたたみ）。既定で閉じた状態で描画する。
  collapsible?: boolean;
}

const GOOGLE_FONTS = [
  { value: "'M PLUS 1 Code', monospace", label: "M PLUS 1 Code" },
  { value: "'Google Sans Code', monospace", label: "Google Sans Code" },
  { value: "'JetBrains Mono', monospace", label: "JetBrains Mono" },
  { value: "'Noto Sans Mono', monospace", label: "Noto Sans Mono" },
  { value: "'Sometype Mono', monospace", label: "Sometype Mono" },
  { value: "'Fira Code', monospace", label: "Fira Code" },
  { value: "'Source Code Pro', monospace", label: "Source Code Pro" },
  { value: "'IBM Plex Mono', monospace", label: "IBM Plex Mono" },
  { value: "'Roboto Mono', monospace", label: "Roboto Mono" },
  { value: "'Ubuntu Mono', monospace", label: "Ubuntu Mono" },
  { value: "'Inconsolata', monospace", label: "Inconsolata" },
  { value: "'Anonymous Pro', monospace", label: "Anonymous Pro" },
  { value: "'Cousine', monospace", label: "Cousine" },
  { value: "'PT Mono', monospace", label: "PT Mono" },
  { value: "'Space Mono', monospace", label: "Space Mono" },
  { value: "'VT323', monospace", label: "VT323" },
  { value: "'Press Start 2P', monospace", label: "Press Start 2P" },
  { value: "'Bitcount Prop Single', monospace", label: "Bitcount Prop Single" },
  { value: "'Kaisei Decol', monospace", label: "Kaisei Decol" },
  { value: "'Dela Gothic One', monospace", label: "Dela Gothic One" },
  { value: "'Hachi Maru Pop', monospace", label: "Hachi Maru Pop" },
];

function loadGoogleFont(fontFamily: string): void {
  const fontName = fontFamily.replace(/'/g, "").split(",")[0].trim();
  const fontId = `google-font-${fontName.replace(/\s+/g, "-").toLowerCase()}`;

  if (document.getElementById(fontId)) return;

  const link = document.createElement("link");
  link.id = fontId;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;500;700&display=swap`;
  document.head.appendChild(link);
}

// すべてのフォントを事前に読み込む
function preloadAllFonts(): void {
  for (const font of GOOGLE_FONTS) {
    loadGoogleFont(font.value);
  }
}

const EDITOR_THEMES = [
  { value: "transparent-dark", label: "Default Dark" },
  { value: "monokai", label: "Monokai" },
  { value: "dracula", label: "Dracula" },
  { value: "github-dark", label: "GitHub Dark" },
  { value: "nord", label: "Nord" },
  { value: "solarized", label: "Solarized" },
  { value: "one-dark", label: "One Dark" },
  { value: "cyberpunk", label: "Cyberpunk" },
];

const SETTING_GROUPS: SettingGroup[] = [
  {
    title: "Theme",
    settings: [
      {
        key: "editorTheme",
        label: "Color Scheme",
        type: "select",
        options: EDITOR_THEMES,
      },
    ],
  },
  {
    title: "Font",
    settings: [
      {
        key: "fontSize",
        label: "Size",
        type: "range",
        min: 10,
        max: 48,
        step: 1,
      },
      {
        key: "fontWeight",
        label: "Weight",
        type: "range",
        min: 100,
        max: 900,
        step: 100,
      },
      {
        key: "lineHeight",
        label: "Line Height",
        type: "range",
        min: 1,
        max: 2,
        step: 0.1,
      },
      {
        key: "fontFamily",
        label: "Family",
        type: "select",
        options: GOOGLE_FONTS,
      },
    ],
  },
  {
    title: "Text",
    settings: [
      {
        key: "textOpacity",
        label: "Opacity",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
      },
      {
        key: "textShadowBlur",
        label: "Shadow Blur",
        type: "range",
        min: 0,
        max: 10,
        step: 1,
      },
      { key: "textShadowColor", label: "Shadow Color", type: "color" },
    ],
  },
  {
    title: "Line Numbers",
    settings: [
      {
        key: "lineNumberOpacity",
        label: "Opacity",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
      },
    ],
  },
  {
    title: "Cursor",
    settings: [
      {
        key: "cursorOpacity",
        label: "Opacity",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
      },
      {
        key: "cursorWidth",
        label: "Width",
        type: "range",
        min: 1,
        max: 4,
        step: 1,
      },
      { key: "cursorColor", label: "Color", type: "color" },
    ],
  },
  {
    title: "Selection",
    settings: [
      {
        key: "selectionOpacity",
        label: "Opacity",
        type: "range",
        min: 0,
        max: 0.5,
        step: 0.05,
      },
    ],
  },
  {
    title: "Current Line",
    settings: [
      {
        key: "currentLineOpacity",
        label: "Opacity",
        type: "range",
        min: 0,
        max: 0.3,
        step: 0.01,
      },
      { key: "currentLineColor", label: "Color", type: "color" },
    ],
  },
  {
    title: "Autocomplete",
    settings: [
      {
        key: "suggestBackgroundOpacity",
        label: "Background",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
      },
      {
        key: "suggestBlur",
        label: "Blur",
        type: "range",
        min: 0,
        max: 20,
        step: 1,
      },
      {
        key: "suggestTextOpacity",
        label: "Text Opacity",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
      },
    ],
  },
  {
    title: "Layout",
    settings: [
      {
        key: "editorPadding",
        label: "Padding",
        type: "range",
        min: 0,
        max: 64,
        step: 4,
      },
    ],
  },
  {
    title: "Editor Features",
    settings: [
      { key: "indentGuides", label: "Indent Guides", type: "checkbox" },
      { key: "bracketPairGuides", label: "Bracket Guides", type: "checkbox" },
      { key: "bracketMatching", label: "Bracket Match", type: "checkbox" },
      { key: "smoothScrolling", label: "Smooth Scroll", type: "checkbox" },
      { key: "stickyScroll", label: "Sticky Scroll", type: "checkbox" },
    ],
  },
  {
    title: "Code Style",
    settings: [
      {
        key: "tabSize",
        label: "Tab Size",
        type: "range",
        min: 2,
        max: 8,
        step: 1,
      },
      {
        key: "renderWhitespace",
        label: "Whitespace",
        type: "select",
        options: [
          { value: "none", label: "None" },
          { value: "boundary", label: "Boundary" },
          { value: "selection", label: "Selection" },
          { value: "trailing", label: "Trailing" },
          { value: "all", label: "All" },
        ],
      },
      {
        key: "wordWrap",
        label: "Word Wrap",
        type: "select",
        options: [
          { value: "on", label: "On" },
          { value: "off", label: "Off" },
          { value: "wordWrapColumn", label: "Column" },
          { value: "bounded", label: "Bounded" },
        ],
      },
    ],
  },
  {
    title: "Cursor Behavior",
    settings: [
      {
        key: "cursorBlinking",
        label: "Blinking",
        type: "select",
        options: [
          { value: "blink", label: "Blink" },
          { value: "smooth", label: "Smooth" },
          { value: "phase", label: "Phase" },
          { value: "expand", label: "Expand" },
          { value: "solid", label: "Solid" },
        ],
      },
      {
        key: "cursorStyle",
        label: "Style",
        type: "select",
        options: [
          { value: "line", label: "Line" },
          { value: "line-thin", label: "Line Thin" },
          { value: "block", label: "Block" },
          { value: "block-outline", label: "Block Outline" },
          { value: "underline", label: "Underline" },
          { value: "underline-thin", label: "Underline Thin" },
        ],
      },
    ],
  },
  {
    title: "Transition",
    settings: [
      {
        key: "previewTransition",
        label: "Type",
        type: "select",
        options: TRANSITION_OPTIONS,
      },
      {
        key: "previewTransitionMs",
        label: "Duration (ms)",
        type: "range",
        min: 100,
        max: 2000,
        step: 50,
      },
    ],
  },
  {
    title: "Audio Reactive (beta)",
    id: "audio",
    collapsible: true,
    settings: [
      {
        key: "audioSource",
        label: "Source",
        type: "select",
        options: AUDIO_SOURCE_OPTIONS,
      },
      {
        key: "beatSensitivity",
        label: "Sensitivity",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
      },
      {
        key: "beatBandMinHz",
        label: "Band min (Hz)",
        type: "range",
        min: 20,
        max: 500,
        step: 10,
      },
      {
        key: "beatBandMaxHz",
        label: "Band max (Hz)",
        type: "range",
        min: 500,
        max: 8000,
        step: 100,
      },
      {
        key: "beatFloor",
        label: "Noise floor",
        type: "range",
        min: 0,
        max: 0.03,
        step: 0.002,
      },
      {
        key: "beatMinIntervalMs",
        label: "Min interval (ms)",
        type: "range",
        min: 60,
        max: 400,
        step: 10,
      },
      {
        key: "beatPattern",
        label: "Pattern",
        type: "select",
        options: PATTERN_OPTIONS,
      },
    ],
  },
];

export type SettingsChangeCallback = (settings: EditorSettings) => void;

export class SettingsPanel {
  private panel: HTMLElement;
  private settings: EditorSettings;
  private isOpen = false;
  private onChange: SettingsChangeCallback | null = null;
  // トークン削除後に接続ドット等を更新させるためのコールバック。
  private onTokensCleared: (() => void) | null = null;
  // 音声ビート可視化の有効/無効トグル。enabled と現在の設定を渡す。
  private onAudioToggle:
    | ((enabled: boolean, settings: EditorSettings) => void)
    | null = null;

  private constructor(container: HTMLElement, settings: EditorSettings) {
    this.settings = settings;

    this.panel = document.createElement("div");
    this.panel.id = "settings-panel";
    this.panel.innerHTML = this.buildHTML();
    container.appendChild(this.panel);

    // すべてのフォントを事前に読み込む
    preloadAllFonts();

    // ドロップダウン外クリックで閉じる。bindEvents は Reset のたびに再実行される
    // ため、document へのリスナーはここで一度だけ登録してリークを防ぐ（panel 要素
    // は再描画されても同一インスタンスのまま）。
    document.addEventListener("click", () => {
      this.panel.querySelectorAll(".custom-select.open").forEach((d) => {
        d.classList.remove("open");
        d.querySelector(".custom-select-trigger")?.setAttribute(
          "aria-expanded",
          "false"
        );
      });
    });

    this.bindEvents();
  }

  static async create(
    container: HTMLElement,
    settings?: EditorSettings
  ): Promise<SettingsPanel> {
    // 起動時に main 側で読み済みの設定を渡せば IndexedDB の二重読みを避けられる。
    const resolved = settings ?? (await loadSettings());
    return new SettingsPanel(container, resolved);
  }

  setOnChange(callback: SettingsChangeCallback): void {
    this.onChange = callback;
  }

  setOnTokensCleared(callback: () => void): void {
    this.onTokensCleared = callback;
  }

  setOnAudioToggle(
    callback: (enabled: boolean, settings: EditorSettings) => void
  ): void {
    this.onAudioToggle = callback;
  }

  // コントローラからの状態をパネルへ反映する（ステータス文言 + トグルの見た目）。
  setAudioStatus(text: string, enabled?: boolean): void {
    const statusEl = this.panel.querySelector<HTMLElement>(".audio-status");
    if (statusEl) statusEl.textContent = text;
    if (enabled !== undefined) {
      const toggle = this.panel.querySelector<HTMLInputElement>(
        ".audio-enable-toggle"
      );
      if (toggle) toggle.checked = enabled;
    }
  }

  private notifyChange(): void {
    applySettings(this.settings);
    saveSettings(this.settings).catch(() => {});
    this.onChange?.(this.settings);
  }

  private buildHTML(): string {
    let html = `<div class="settings-header">
      <span>Settings</span>
      <button class="settings-close">×</button>
    </div>
    <div class="settings-content">`;

    for (const group of SETTING_GROUPS) {
      const collapsible = group.collapsible === true;
      const bodyId = group.id ? `settings-group-${group.id}` : "";

      // 折りたたみ群は見出しをトグルボタンにし、中身を body でくるんで開閉する。
      // 既定は閉じた状態（collapsed）。
      if (collapsible) {
        html += `<div class="settings-group collapsible collapsed">
          <button type="button" class="settings-group-title settings-group-toggle"
            aria-expanded="false" aria-controls="${bodyId}">
            <span>${group.title}</span>
            <span class="settings-group-chevron" aria-hidden="true">▾</span>
          </button>
          <div class="settings-group-body" id="${bodyId}">`;
      } else {
        html += `<div class="settings-group">
          <div class="settings-group-title">${group.title}</div>`;
      }

      // 音声セクションは有効化トグル + ステータスを先頭に差し込む。
      // 有効状態は永続化しない（既定 OFF・ユーザー操作で権限取得）。
      if (group.id === "audio") {
        html += `<div class="settings-row">
          <label for="audio-enable">React to beat</label>
          <input type="checkbox" id="audio-enable" class="audio-enable-toggle">
        </div>
        <p class="audio-status" role="status" aria-live="polite">Off</p>`;
      }

      for (const setting of group.settings) {
        const value = this.settings[setting.key];
        const inputId = `set-${setting.key}`;
        const labelId = `setlabel-${setting.key}`;
        // select はカスタムドロップダウン（非フォーム要素）なので for ではなく
        // aria-labelledby で関連付ける。それ以外は for/id で関連付ける。
        const labelAttrs =
          setting.type === "select" ? `id="${labelId}"` : `for="${inputId}"`;
        html += `<div class="settings-row">
          <label ${labelAttrs}>${setting.label}</label>`;

        if (setting.type === "range") {
          html += `<input type="range"
            id="${inputId}"
            data-key="${setting.key}"
            min="${setting.min}"
            max="${setting.max}"
            step="${setting.step}"
            value="${value}">
          <span class="settings-value">${value}</span>`;
        } else if (setting.type === "color") {
          html += `<input type="color" id="${inputId}" data-key="${setting.key}" value="${value}">`;
        } else if (setting.type === "select" && setting.options) {
          // カスタムドロップダウン（フォントは各オプションを実フォントで描くため
          // native select には置き換えられない）。listbox パターンで AT 対応する。
          const currentOpt = setting.options.find((o) => o.value === value);
          const currentLabel = currentOpt?.label || "";
          const isFontSelect = setting.key === "fontFamily";
          const fontStyle = isFontSelect ? `style="font-family: ${value}"` : "";
          html += `<div class="custom-select" data-key="${setting.key}" data-font="${isFontSelect}">
            <div class="custom-select-trigger" role="combobox" tabindex="0"
              aria-haspopup="listbox" aria-expanded="false" aria-labelledby="${labelId}"
              ${fontStyle}>${currentLabel}</div>
            <div class="custom-select-options" role="listbox" aria-labelledby="${labelId}">`;
          for (const opt of setting.options) {
            const isSel = opt.value === value;
            const selected = isSel ? "selected" : "";
            const optFontStyle = isFontSelect
              ? `style="font-family: ${opt.value}"`
              : "";
            html += `<div class="custom-select-option ${selected}" role="option"
              aria-selected="${isSel}" tabindex="-1" data-value="${opt.value}" ${optFontStyle}>${opt.label}</div>`;
          }
          html += `</div></div>`;
        } else if (setting.type === "checkbox") {
          const checked = value ? "checked" : "";
          html += `<input type="checkbox" id="${inputId}" data-key="${setting.key}" ${checked}>`;
        } else {
          html += `<input type="text" id="${inputId}" data-key="${setting.key}" value="${value}">`;
        }

        html += `</div>`;
      }

      if (collapsible) html += `</div>`; // close .settings-group-body
      html += `</div>`; // close .settings-group
    }

    // フッター/メタも .settings-content（スクロール領域）の中に置き、ヘッダは
    // 固定のまま、フッターはスクロールの一番下に出るようにする。content の
    // 閉じ </div> は末尾でまとめて閉じる。

    // バージョン表示: コミットハッシュは GitHub のコミットページへリンク
    const commit = __GIT_COMMIT__;
    const commitHtml =
      commit && commit !== "unknown"
        ? `<a class="settings-commit" href="https://github.com/shinyaoguri/canvastage/commit/${commit}" target="_blank" rel="noopener noreferrer">${commit}</a>`
        : `<span class="settings-commit">${commit}</span>`;

    html += `<div class="settings-footer">
      <button class="settings-reset">Reset to Defaults</button>
      <a class="settings-github" href="https://github.com/shinyaoguri/canvastage" target="_blank" rel="noopener noreferrer">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
        <span>GitHub</span>
      </a>
    </div>
    <div class="settings-meta">
      <span class="settings-version">v${__APP_VERSION__} · ${commitHtml}</span>
      <div class="settings-security-note">
        <span class="settings-security-title">⚠ 信頼できないコードは実行しないでください</span>
        <span class="settings-security-desc">プレビューはこのページと同一オリジンで実行されます。他人の・出所不明なスケッチを実行すると、そのコードが保存済みの GitHub / OpenProcessing トークンを読み取り外部へ送信できてしまいます。信頼できるコードだけ実行し、共有 PC では使用後にトークンを削除してください。</span>
        <button class="settings-clear-tokens">保存したトークンを削除</button>
      </div>
    </div>
    </div>`;
    return html;
  }

  private bindEvents(): void {
    // 折りたたみ群（アコーディオン）の開閉
    this.panel.querySelectorAll(".settings-group-toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        const groupEl = btn.closest(".settings-group");
        if (!groupEl) return;
        const collapsed = groupEl.classList.toggle("collapsed");
        btn.setAttribute("aria-expanded", String(!collapsed));
      });
    });

    // 入力変更（range, text, color）
    this.panel
      .querySelectorAll("input:not([type='checkbox'])")
      .forEach((input) => {
        input.addEventListener("input", (e) => {
          const target = e.target as HTMLInputElement;
          const key = target.dataset.key as keyof EditorSettings;
          let value: string | number = target.value;

          if (target.type === "range") {
            value = parseFloat(value);
            const valueSpan = target.nextElementSibling as HTMLSpanElement;
            if (valueSpan) valueSpan.textContent = String(value);
          }

          (this.settings as unknown as Record<string, string | number>)[key] =
            value;
          this.notifyChange();
        });
      });

    // チェックボックス変更（data-key を持つ設定項目のみ。音声トグルは別扱い）
    this.panel
      .querySelectorAll("input[type='checkbox'][data-key]")
      .forEach((input) => {
        input.addEventListener("change", (e) => {
          const target = e.target as HTMLInputElement;
          const key = target.dataset.key as keyof EditorSettings;
          (this.settings as unknown as Record<string, boolean>)[key] =
            target.checked;
          this.notifyChange();
        });
      });

    // カスタムドロップダウン（listbox パターン: マウス + キーボード両対応）
    this.panel.querySelectorAll(".custom-select").forEach((dropdown) => {
      const trigger = dropdown.querySelector(
        ".custom-select-trigger"
      ) as HTMLElement;
      const options = dropdown.querySelector(
        ".custom-select-options"
      ) as HTMLElement;
      const optionEls = Array.from(
        options.querySelectorAll<HTMLElement>(".custom-select-option")
      );

      const setOpen = (open: boolean) => {
        dropdown.classList.toggle("open", open);
        trigger.setAttribute("aria-expanded", String(open));
      };
      const close = () => setOpen(false);
      const openAndFocus = () => {
        // 他のドロップダウンを閉じてから開き、選択中の項目へフォーカスする。
        this.panel.querySelectorAll(".custom-select.open").forEach((d) => {
          if (d !== dropdown) {
            d.classList.remove("open");
            d.querySelector(".custom-select-trigger")?.setAttribute(
              "aria-expanded",
              "false"
            );
          }
        });
        setOpen(true);
        (
          optionEls.find((o) => o.classList.contains("selected")) ??
          optionEls[0]
        )?.focus();
      };

      const selectOption = (option: HTMLElement) => {
        const key = (dropdown as HTMLElement).dataset
          .key as keyof EditorSettings;
        const value = option.dataset.value as string;
        const label = option.textContent || "";
        const isFontSelect = (dropdown as HTMLElement).dataset.font === "true";

        // 選択状態を更新（class と aria-selected を同期）
        optionEls.forEach((o) => {
          o.classList.remove("selected");
          o.setAttribute("aria-selected", "false");
        });
        option.classList.add("selected");
        option.setAttribute("aria-selected", "true");

        // トリガーのテキストを更新
        trigger.textContent = label;
        if (isFontSelect) trigger.style.fontFamily = value;

        // 設定を更新
        (this.settings as unknown as Record<string, string | number>)[key] =
          value;
        this.notifyChange();

        close();
        trigger.focus();
      };

      trigger?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (dropdown.classList.contains("open")) close();
        else openAndFocus();
      });

      trigger?.addEventListener("keydown", (e) => {
        const ke = e as KeyboardEvent;
        if (ke.key === "Enter" || ke.key === " " || ke.key === "ArrowDown") {
          ke.preventDefault();
          openAndFocus();
        } else if (ke.key === "Escape") {
          close();
        }
      });

      optionEls.forEach((option, i) => {
        option.addEventListener("click", () => selectOption(option));
        option.addEventListener("keydown", (e) => {
          const ke = e as KeyboardEvent;
          if (ke.key === "Enter" || ke.key === " ") {
            ke.preventDefault();
            selectOption(option);
          } else if (ke.key === "ArrowDown") {
            ke.preventDefault();
            optionEls[Math.min(i + 1, optionEls.length - 1)]?.focus();
          } else if (ke.key === "ArrowUp") {
            ke.preventDefault();
            optionEls[Math.max(i - 1, 0)]?.focus();
          } else if (ke.key === "Escape") {
            ke.preventDefault();
            close();
            trigger.focus();
          }
        });
      });
    });

    // 音声ビート可視化の有効/無効トグル（永続化しないランタイム操作）。
    // change はユーザー操作なので、ここから権限取得を始めても activation を保てる。
    this.panel
      .querySelector(".audio-enable-toggle")
      ?.addEventListener("change", (e) => {
        const checked = (e.target as HTMLInputElement).checked;
        this.onAudioToggle?.(checked, this.settings);
      });

    // リセット
    this.panel
      .querySelector(".settings-reset")
      ?.addEventListener("click", () => {
        this.settings = { ...DEFAULT_SETTINGS };
        this.notifyChange();
        this.panel.innerHTML = this.buildHTML();
        this.bindEvents();
      });

    // 保存したトークンを削除（GitHub / OpenProcessing）
    this.panel
      .querySelector(".settings-clear-tokens")
      ?.addEventListener("click", (e) => {
        const btn = e.currentTarget as HTMLButtonElement;
        btn.disabled = true;
        void Promise.all([clearGithubToken(), clearOpenProcessingToken()])
          .then(() => {
            btn.textContent = "削除しました ✓";
            // 接続ドット等を実態に同期させる
            this.onTokensCleared?.();
            setTimeout(() => {
              btn.textContent = "保存したトークンを削除";
              btn.disabled = false;
            }, 2000);
          })
          .catch(() => {
            // 削除に失敗してもボタンが永久に disabled のまま残らないようにする
            btn.textContent = "削除に失敗しました";
            setTimeout(() => {
              btn.textContent = "保存したトークンを削除";
              btn.disabled = false;
            }, 2000);
          });
      });

    // 閉じる
    this.panel
      .querySelector(".settings-close")
      ?.addEventListener("click", () => {
        this.close();
      });
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  private opener: HTMLElement | null = null;
  private onEsc = (e: KeyboardEvent) => {
    if (e.key === "Escape") this.close();
  };

  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.opener = document.activeElement as HTMLElement | null;
    this.panel.classList.add("open");
    document.addEventListener("keydown", this.onEsc);
    // パネル先頭の操作子（閉じるボタン）へフォーカスを移す。
    this.panel.querySelector<HTMLElement>(".settings-close")?.focus();
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.panel.classList.remove("open");
    document.removeEventListener("keydown", this.onEsc);
    // 開く前の要素（多くは設定ボタン）へフォーカスを戻す。
    this.opener?.focus?.();
    this.opener = null;
  }
}
