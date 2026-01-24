import {
  EditorSettings,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  applySettings,
} from "./settings";

interface SettingDef {
  key: keyof EditorSettings;
  label: string;
  type: "range" | "text" | "color" | "select" | "checkbox";
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
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

const SETTING_GROUPS: { title: string; settings: SettingDef[] }[] = [
  {
    title: "Theme",
    settings: [
      { key: "editorTheme", label: "Color Scheme", type: "select", options: EDITOR_THEMES },
    ],
  },
  {
    title: "Font",
    settings: [
      { key: "fontSize", label: "Size", type: "range", min: 10, max: 24, step: 1 },
      { key: "fontWeight", label: "Weight", type: "range", min: 100, max: 900, step: 100 },
      { key: "lineHeight", label: "Line Height", type: "range", min: 1, max: 2, step: 0.1 },
      { key: "fontFamily", label: "Family", type: "select", options: GOOGLE_FONTS },
    ],
  },
  {
    title: "Text",
    settings: [
      { key: "textOpacity", label: "Opacity", type: "range", min: 0, max: 1, step: 0.05 },
      { key: "textShadowBlur", label: "Shadow Blur", type: "range", min: 0, max: 10, step: 1 },
      { key: "textShadowColor", label: "Shadow Color", type: "color" },
    ],
  },
  {
    title: "Line Numbers",
    settings: [
      { key: "lineNumberOpacity", label: "Opacity", type: "range", min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    title: "Cursor",
    settings: [
      { key: "cursorOpacity", label: "Opacity", type: "range", min: 0, max: 1, step: 0.05 },
      { key: "cursorWidth", label: "Width", type: "range", min: 1, max: 4, step: 1 },
      { key: "cursorColor", label: "Color", type: "color" },
    ],
  },
  {
    title: "Selection",
    settings: [
      { key: "selectionOpacity", label: "Opacity", type: "range", min: 0, max: 0.5, step: 0.05 },
    ],
  },
  {
    title: "Current Line",
    settings: [
      { key: "currentLineOpacity", label: "Opacity", type: "range", min: 0, max: 0.3, step: 0.01 },
      { key: "currentLineColor", label: "Color", type: "color" },
    ],
  },
  {
    title: "Autocomplete",
    settings: [
      { key: "suggestBackgroundOpacity", label: "Background", type: "range", min: 0, max: 1, step: 0.05 },
      { key: "suggestBlur", label: "Blur", type: "range", min: 0, max: 20, step: 1 },
      { key: "suggestTextOpacity", label: "Text Opacity", type: "range", min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    title: "Layout",
    settings: [
      { key: "editorPadding", label: "Padding", type: "range", min: 0, max: 64, step: 4 },
    ],
  },
  {
    title: "Editor Features",
    settings: [
      { key: "indentGuides", label: "Indent Guides", type: "checkbox" },
      { key: "bracketPairGuides", label: "Bracket Guides", type: "checkbox" },
      { key: "bracketMatching", label: "Bracket Match", type: "checkbox" },
      { key: "minimap", label: "Minimap", type: "checkbox" },
      { key: "smoothScrolling", label: "Smooth Scroll", type: "checkbox" },
      { key: "stickyScroll", label: "Sticky Scroll", type: "checkbox" },
    ],
  },
  {
    title: "Code Style",
    settings: [
      { key: "tabSize", label: "Tab Size", type: "range", min: 2, max: 8, step: 1 },
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
];

export type SettingsChangeCallback = (settings: EditorSettings) => void;

export class SettingsPanel {
  private panel: HTMLElement;
  private settings: EditorSettings;
  private isOpen = false;
  private onChange: SettingsChangeCallback | null = null;

  constructor(container: HTMLElement) {
    this.settings = loadSettings();

    this.panel = document.createElement("div");
    this.panel.id = "settings-panel";
    this.panel.innerHTML = this.buildHTML();
    container.appendChild(this.panel);

    // すべてのフォントを事前に読み込む
    preloadAllFonts();

    this.bindEvents();
  }

  setOnChange(callback: SettingsChangeCallback): void {
    this.onChange = callback;
  }

  getSettings(): EditorSettings {
    return this.settings;
  }

  private notifyChange(): void {
    applySettings(this.settings);
    saveSettings(this.settings);
    this.onChange?.(this.settings);
  }

  private buildHTML(): string {
    let html = `<div class="settings-header">
      <span>Settings</span>
      <button class="settings-close">×</button>
    </div>
    <div class="settings-content">`;

    for (const group of SETTING_GROUPS) {
      html += `<div class="settings-group">
        <div class="settings-group-title">${group.title}</div>`;

      for (const setting of group.settings) {
        const value = this.settings[setting.key];
        html += `<div class="settings-row">
          <label>${setting.label}</label>`;

        if (setting.type === "range") {
          html += `<input type="range"
            data-key="${setting.key}"
            min="${setting.min}"
            max="${setting.max}"
            step="${setting.step}"
            value="${value}">
          <span class="settings-value">${value}</span>`;
        } else if (setting.type === "color") {
          html += `<input type="color" data-key="${setting.key}" value="${value}">`;
        } else if (setting.type === "select" && setting.options) {
          // カスタムドロップダウン
          const currentOpt = setting.options.find(o => o.value === value);
          const currentLabel = currentOpt?.label || "";
          const isFontSelect = setting.key === "fontFamily";
          const fontStyle = isFontSelect ? `style="font-family: ${value}"` : "";
          html += `<div class="custom-select" data-key="${setting.key}" data-font="${isFontSelect}">
            <div class="custom-select-trigger" ${fontStyle}>${currentLabel}</div>
            <div class="custom-select-options">`;
          for (const opt of setting.options) {
            const selected = opt.value === value ? "selected" : "";
            const optFontStyle = isFontSelect ? `style="font-family: ${opt.value}"` : "";
            html += `<div class="custom-select-option ${selected}" data-value="${opt.value}" ${optFontStyle}>${opt.label}</div>`;
          }
          html += `</div></div>`;
        } else if (setting.type === "checkbox") {
          const checked = value ? "checked" : "";
          html += `<input type="checkbox" data-key="${setting.key}" ${checked}>`;
        } else {
          html += `<input type="text" data-key="${setting.key}" value="${value}">`;
        }

        html += `</div>`;
      }

      html += `</div>`;
    }

    html += `</div>`;
    html += `<div class="settings-footer">
      <button class="settings-reset">Reset to Defaults</button>
    </div>`;
    return html;
  }

  private bindEvents(): void {
    // 入力変更（range, text, color）
    this.panel.querySelectorAll("input:not([type='checkbox'])").forEach((input) => {
      input.addEventListener("input", (e) => {
        const target = e.target as HTMLInputElement;
        const key = target.dataset.key as keyof EditorSettings;
        let value: string | number = target.value;

        if (target.type === "range") {
          value = parseFloat(value);
          const valueSpan = target.nextElementSibling as HTMLSpanElement;
          if (valueSpan) valueSpan.textContent = String(value);
        }

        (this.settings as unknown as Record<string, string | number>)[key] = value;
        this.notifyChange();
      });
    });

    // チェックボックス変更
    this.panel.querySelectorAll("input[type='checkbox']").forEach((input) => {
      input.addEventListener("change", (e) => {
        const target = e.target as HTMLInputElement;
        const key = target.dataset.key as keyof EditorSettings;
        (this.settings as unknown as Record<string, boolean>)[key] = target.checked;
        this.notifyChange();
      });
    });

    // カスタムドロップダウン
    this.panel.querySelectorAll(".custom-select").forEach((dropdown) => {
      const trigger = dropdown.querySelector(".custom-select-trigger") as HTMLElement;
      const options = dropdown.querySelector(".custom-select-options") as HTMLElement;

      trigger?.addEventListener("click", (e) => {
        e.stopPropagation();
        // 他のドロップダウンを閉じる
        this.panel.querySelectorAll(".custom-select.open").forEach(d => {
          if (d !== dropdown) d.classList.remove("open");
        });
        dropdown.classList.toggle("open");
      });

      options?.querySelectorAll(".custom-select-option").forEach((option) => {
        option.addEventListener("click", () => {
          const key = (dropdown as HTMLElement).dataset.key as keyof EditorSettings;
          const value = (option as HTMLElement).dataset.value as string;
          const label = option.textContent || "";
          const isFontSelect = (dropdown as HTMLElement).dataset.font === "true";

          // 選択状態を更新
          options.querySelectorAll(".custom-select-option").forEach(o => o.classList.remove("selected"));
          option.classList.add("selected");

          // トリガーのテキストを更新
          trigger.textContent = label;
          if (isFontSelect) {
            trigger.style.fontFamily = value;
          }

          // 設定を更新
          (this.settings as unknown as Record<string, string | number>)[key] = value;
          this.notifyChange();

          // ドロップダウンを閉じる
          dropdown.classList.remove("open");
        });
      });
    });

    // ドロップダウン外クリックで閉じる
    document.addEventListener("click", () => {
      this.panel.querySelectorAll(".custom-select.open").forEach(d => d.classList.remove("open"));
    });

    // リセット
    this.panel.querySelector(".settings-reset")?.addEventListener("click", () => {
      this.settings = { ...DEFAULT_SETTINGS };
      this.notifyChange();
      this.panel.innerHTML = this.buildHTML();
      this.bindEvents();
    });

    // 閉じる
    this.panel.querySelector(".settings-close")?.addEventListener("click", () => {
      this.close();
    });
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
    this.panel.classList.toggle("open", this.isOpen);
  }

  close(): void {
    this.isOpen = false;
    this.panel.classList.remove("open");
  }
}
