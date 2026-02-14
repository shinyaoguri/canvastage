import "./style.css";
import { createEditor } from "./code-editor";
import { Preview, Files } from "./preview";
import { SettingsPanel } from "./settings-panel";
import { SamplesPanel } from "./samples-panel";
import { ConsolePanel } from "./console-panel";
import { loadSettings, applySettings, EditorSettings } from "./settings";
import { DEFAULT_FILES } from "./defaults";
import { getRandomBasicsSample } from "./samples";
import { ShareButton } from "./share";

type FileType = "html" | "css" | "js";

const LANGUAGES: Record<FileType, string> = {
  html: "html",
  css: "css",
  js: "javascript",
};

async function init() {
  const app = document.getElementById("app")!;

  // 設定を読み込んで適用
  applySettings(await loadSettings());

  // ファイル内容を管理（basicsからランダムに初期サンプルを選択）
  const initialFiles = getRandomBasicsSample() ?? { ...DEFAULT_FILES };
  const files: Files = initialFiles;
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
  const settingsPanel = await SettingsPanel.create(app);
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

  // シェアボタン
  const shareButton = new ShareButton(app, () => {
    files[currentFile] = editor.getValue();
    return { ...files };
  });

  // 新規プロジェクトボタン
  const newProjectBtn = document.createElement("button");
  newProjectBtn.id = "new-project-btn";
  newProjectBtn.className = "toolbar-btn";
  newProjectBtn.title = "New Project";
  newProjectBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="12" y1="18" x2="12" y2="12"/>
    <line x1="9" y1="15" x2="15" y2="15"/>
  </svg>`;
  app.appendChild(newProjectBtn);

  // プロジェクト名エリア（再生ボタン + プロジェクト名）
  const projectBar = document.createElement("div");
  projectBar.id = "project-bar";

  // 再生/停止ボタン
  let isRunning = false;
  const runStopBtn = document.createElement("button");
  runStopBtn.id = "run-stop-btn";
  runStopBtn.className = "toolbar-btn";
  runStopBtn.title = "Run (⌘+Enter)";
  const playIcon = `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="6,3 20,12 6,21"/></svg>`;
  const stopIcon = `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>`;
  runStopBtn.innerHTML = playIcon;
  projectBar.appendChild(runStopBtn);

  const projectNameInput = document.createElement("input");
  projectNameInput.id = "project-name";
  projectNameInput.type = "text";
  projectNameInput.value = shareButton.getProjectName();
  projectNameInput.spellcheck = false;
  projectNameInput.addEventListener("input", () => {
    shareButton.setProjectName(projectNameInput.value);
  });
  projectBar.appendChild(projectNameInput);
  app.appendChild(projectBar);

  // 新規プロジェクトのクリック処理
  newProjectBtn.onclick = () => {
    const sample = getRandomBasicsSample() ?? { ...DEFAULT_FILES };
    files.html = sample.html;
    files.css = sample.css;
    files.js = sample.js;
    editor.setValue(files[currentFile]);
    const newName = shareButton.resetProject();
    projectNameInput.value = newName;
    runCode();
  };

  // プレビュー
  const preview = new Preview(app);

  // コンソールパネル
  const consolePanel = new ConsolePanel(app);

  // 実行関数
  const runCode = () => {
    files[currentFile] = editor.getValue();
    consolePanel.clear();
    preview.run(files);
    isRunning = true;
    runStopBtn.innerHTML = stopIcon;
    runStopBtn.title = "Stop";
  };

  const stopCode = () => {
    preview.stop();
    isRunning = false;
    runStopBtn.innerHTML = playIcon;
    runStopBtn.title = "Run (⌘+Enter)";
  };

  runStopBtn.onclick = () => {
    if (isRunning) {
      stopCode();
    } else {
      runCode();
    }
  };

  // エディタ
  const editor = createEditor(document.body, files[currentFile], LANGUAGES[currentFile], runCode, initialSettings);

  // エディタ変更時にシェアボタンの状態を更新
  editor.onDidChange(() => {
    shareButton.markDirty();
  });

  // 設定変更時にエディタへ反映
  settingsPanel.setOnChange((settings: EditorSettings) => {
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
