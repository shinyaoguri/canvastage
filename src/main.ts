import "./style.css";
import { createEditor } from "./code-editor";
import { Preview, Files } from "./preview";
import { SettingsPanel } from "./settings-panel";
import { SamplesPanel } from "./samples-panel";
import { loadSettings, applySettings } from "./settings";

type FileType = "html" | "css" | "js";

const DEFAULT_FILES: Files = {
  html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>sketch</title>
  <script src="https://cdn.jsdelivr.net/npm/p5@1/lib/p5.min.js"></script>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <script src="sketch.js"></script>
</body>
</html>`,
  css: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #000;
}

canvas {
  display: block;
}`,
  js: `function setup() {
  createCanvas(windowWidth, windowHeight);
  background(20);
}

function draw() {
  background(20, 20, 30, 25);

  fill(255, 100, 150);
  noStroke();

  let x = width / 2 + sin(frameCount * 0.02) * 200;
  let y = height / 2 + cos(frameCount * 0.03) * 150;
  let size = 50 + sin(frameCount * 0.05) * 30;

  ellipse(x, y, size, size);

  fill(100, 200, 255, 150);
  ellipse(mouseX, mouseY, 30, 30);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}`,
};

const LANGUAGES: Record<FileType, string> = {
  html: "html",
  css: "css",
  js: "javascript",
};

function init() {
  const app = document.getElementById("app")!;

  // 設定を読み込んで適用
  applySettings(loadSettings());

  // ファイル内容を管理
  const files: Files = { ...DEFAULT_FILES };
  let currentFile: FileType = "js";

  // タブ
  const tabs = document.createElement("div");
  tabs.id = "file-tabs";
  const tabButtons: Record<FileType, HTMLButtonElement> = {} as Record<FileType, HTMLButtonElement>;

  (["html", "css", "js"] as FileType[]).forEach((type) => {
    const btn = document.createElement("button");
    btn.textContent = type === "js" ? "sketch.js" : type === "html" ? "index.html" : "style.css";
    btn.className = type === currentFile ? "active" : "";
    btn.onclick = () => switchTab(type);
    tabs.appendChild(btn);
    tabButtons[type] = btn;
  });
  app.appendChild(tabs);

  // 設定パネル
  const settingsPanel = new SettingsPanel(app);
  const initialSettings = settingsPanel.getSettings();

  // サンプルパネル
  const samplesPanel = new SamplesPanel(app);

  // サンプルボタン
  const samplesBtn = document.createElement("button");
  samplesBtn.id = "samples-btn";
  samplesBtn.className = "toolbar-btn";
  samplesBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    <line x1="8" y1="7" x2="16" y2="7"/>
    <line x1="8" y1="11" x2="14" y2="11"/>
  </svg>`;
  samplesBtn.onclick = () => samplesPanel.toggle();
  app.appendChild(samplesBtn);

  // 設定ボタン
  const settingsBtn = document.createElement("button");
  settingsBtn.id = "settings-btn";
  settingsBtn.className = "toolbar-btn";
  settingsBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
  </svg>`;
  settingsBtn.onclick = () => settingsPanel.toggle();
  app.appendChild(settingsBtn);

  // フルスクリーンボタン
  const fullscreenBtn = document.createElement("button");
  fullscreenBtn.id = "fullscreen-btn";
  fullscreenBtn.className = "toolbar-btn";
  fullscreenBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
  </svg>`;
  fullscreenBtn.onclick = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  };
  app.appendChild(fullscreenBtn);

  // プレビュー
  const preview = new Preview(app);

  // 実行関数
  const runCode = () => {
    files[currentFile] = editor.getValue();
    preview.run(files);
  };

  // エディタ
  const editor = createEditor(document.body, files[currentFile], LANGUAGES[currentFile], runCode, initialSettings);

  // 設定変更時にエディタへ反映
  settingsPanel.setOnChange((settings) => {
    editor.applySettings(settings);
  });

  // サンプル選択時にファイルを読み込み
  samplesPanel.setOnSelect((sampleFiles) => {
    files.html = sampleFiles.html;
    files.css = sampleFiles.css;
    files.js = sampleFiles.js;
    editor.setValue(files[currentFile]);
    runCode();
  });

  // タブ切り替え
  const switchTab = (type: FileType) => {
    if (type === currentFile) return;

    // 現在のファイル内容を保存
    files[currentFile] = editor.getValue();

    // タブのアクティブ状態を更新
    tabButtons[currentFile].className = "";
    tabButtons[type].className = "active";

    // エディタの内容と言語を切り替え
    currentFile = type;
    editor.setValue(files[type]);
    editor.setLanguage(LANGUAGES[type]);
  };

  // 初回実行
  runCode();
}

init();
