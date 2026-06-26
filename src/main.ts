import "./style.css";
import { createEditor } from "./code-editor";
import { Preview, type Files } from "./preview";
import { SettingsPanel } from "./settings-panel";
import { SamplesPanel } from "./samples-panel";
import { ConsolePanel } from "./console-panel";
import { loadSettings, applySettings, type EditorSettings } from "./settings";
import { DEFAULT_FILES } from "./defaults";
import { getRandomBasicsSample } from "./samples";
import { ShareButton } from "./share";
import { OpenProcessingButton } from "./openprocessing-share";
import { GistImportButton } from "./gist-import";
import { AudioReactiveController } from "./audio/audio-reactive";
import { supportsTabAudio } from "./audio/audio-engine";

type FileType = "html" | "css" | "js";

const LANGUAGES: Record<FileType, string> = {
  html: "html",
  css: "css",
  js: "javascript",
};

const TAB_LABELS: Record<FileType, string> = {
  html: "index.html",
  css: "style.css",
  js: "sketch.js",
};

// ツールバー / 再生ボタンのアイコン（SVG）。
const ICONS = {
  samples: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    <line x1="8" y1="7" x2="16" y2="7"/>
    <line x1="8" y1="11" x2="14" y2="11"/>
  </svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>`,
  fullscreen: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
  </svg>`,
  newProject: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="12" y1="18" x2="12" y2="12"/>
    <line x1="9" y1="15" x2="15" y2="15"/>
  </svg>`,
  play: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="6,3 20,12 6,21"/></svg>`,
  stop: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>`,
} as const;

// 共通のツールバーボタン（円形アイコンボタン）を組み立てる。
function makeToolbarButton(opts: {
  id: string;
  svg: string;
  title?: string;
  onClick?: () => void;
}): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.id = opts.id;
  btn.className = "toolbar-btn";
  if (opts.title) {
    btn.title = opts.title;
    // アイコンのみのボタンはスクリーンリーダーに「ボタン」としか読まれないため、
    // title と同じ文言を必ずアクセシブル名として与える。
    btn.setAttribute("aria-label", opts.title);
  }
  btn.innerHTML = opts.svg;
  // 装飾アイコンは支援技術から隠す（ラベルは aria-label が担う）。
  btn.querySelector("svg")?.setAttribute("aria-hidden", "true");
  if (opts.onClick) btn.onclick = opts.onClick;
  return btn;
}

function toggleFullscreen(): void {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    document.documentElement.requestFullscreen();
  }
}

// ファイルタブ（html/css/js）を組み立てる。タブ選択は onSelect に委譲する。
function createTabBar(
  currentFile: FileType,
  onSelect: (type: FileType) => void
): { element: HTMLElement; buttons: Record<FileType, HTMLButtonElement> } {
  const tabs = document.createElement("div");
  tabs.id = "file-tabs";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "編集するファイル");
  const buttons = {} as Record<FileType, HTMLButtonElement>;

  (["html", "css", "js"] as FileType[]).forEach((type) => {
    const btn = document.createElement("button");
    btn.textContent = TAB_LABELS[type];
    const active = type === currentFile;
    btn.className = active ? "active" : "";
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", String(active));
    btn.onclick = () => onSelect(type);
    tabs.appendChild(btn);
    buttons[type] = btn;
  });

  return { element: tabs, buttons };
}

// 右上ツールバー（samples / settings / fullscreen / new-project）を app に並べる。
// 各ボタンは CSS の id 個別ルールで絶対配置されるため、追加順は見た目に影響しない。
// new-project の onclick はエディタ等の生成後に配線するため、ボタン参照を返す。
function createToolbar(
  app: HTMLElement,
  handlers: { onSamples: () => void; onSettings: () => void }
): { newProjectBtn: HTMLButtonElement } {
  app.appendChild(
    makeToolbarButton({
      id: "samples-btn",
      svg: ICONS.samples,
      title: "サンプル",
      onClick: handlers.onSamples,
    })
  );
  app.appendChild(
    makeToolbarButton({
      id: "settings-btn",
      svg: ICONS.settings,
      title: "設定",
      onClick: handlers.onSettings,
    })
  );
  app.appendChild(
    makeToolbarButton({
      id: "fullscreen-btn",
      svg: ICONS.fullscreen,
      title: "全画面表示",
      onClick: toggleFullscreen,
    })
  );
  const newProjectBtn = makeToolbarButton({
    id: "new-project-btn",
    title: "新規プロジェクト",
    svg: ICONS.newProject,
  });
  app.appendChild(newProjectBtn);

  return { newProjectBtn };
}

async function init() {
  const app = document.getElementById("app")!;

  // 設定を読み込んで適用（SettingsPanel にも渡して IndexedDB の二重読みを避ける）
  const initialSettings = await loadSettings();
  // 非対応ブラウザでは保存値が "tab" でも実行できないので "mic" に矯正する。
  if (initialSettings.audioSource === "tab" && !supportsTabAudio()) {
    initialSettings.audioSource = "mic";
  }
  applySettings(initialSettings);
  // 最新の設定値（runCode の切り替え演出など、実行時に参照する用）。
  let currentSettings = initialSettings;

  // ファイル内容を管理（basicsからランダムに初期サンプルを選択）
  const initialFiles = getRandomBasicsSample() ?? { ...DEFAULT_FILES };
  const files: Files = initialFiles;
  let currentFile: FileType = "js";

  // 現在のエディタ内容を files に取り込み、その files を返す（共有スナップショット）。
  const snapshot = (): Files => {
    files[currentFile] = editor.getValue();
    return files;
  };

  // タブ（クリックは下で定義する switchTab に委譲）
  const { element: tabs, buttons: tabButtons } = createTabBar(
    currentFile,
    (type) => switchTab(type)
  );
  app.appendChild(tabs);

  // 設定パネル / サンプルパネル
  const settingsPanel = await SettingsPanel.create(app, initialSettings);
  const samplesPanel = new SamplesPanel(app);

  // 右上ツールバー
  const { newProjectBtn } = createToolbar(app, {
    onSamples: () => samplesPanel.toggle(),
    onSettings: () => settingsPanel.toggle(),
  });

  // シェアボタン
  const shareButton = new ShareButton(app, () => ({ ...snapshot() }));

  // OpenProcessing デプロイボタン（GitHub とは独立）
  const openProcessingButton = new OpenProcessingButton(
    app,
    () => ({ ...snapshot() }),
    () => shareButton.getProjectName()
  );

  // Gist 取り込みボタン（onImport は editor 等の生成後に配線する）
  const importButton = new GistImportButton(app);

  // プロジェクト名エリア（再生ボタン + プロジェクト名）
  const projectBar = document.createElement("div");
  projectBar.id = "project-bar";

  // 再生/停止ボタン
  let isRunning = false;
  // 最後の実行以降にコードが編集されたか（実行中の表示が古いことを示す）。
  let staleSinceRun = false;
  // 実行ショートカットの修飾キー表記を OS に合わせる（Mac は ⌘、それ以外は Ctrl）。
  const isMac = navigator.platform.toUpperCase().includes("MAC");
  const RUN_LABEL = `実行 (${isMac ? "⌘" : "Ctrl"}+Enter)`;
  const STOP_LABEL = "停止";
  // title と aria-label を同時に更新する（アイコンのみのボタンの名前を保つ）。
  const setBtnLabel = (btn: HTMLButtonElement, text: string) => {
    btn.title = text;
    btn.setAttribute("aria-label", text);
  };
  const runStopBtn = makeToolbarButton({
    id: "run-stop-btn",
    title: RUN_LABEL,
    svg: ICONS.play,
  });
  projectBar.appendChild(runStopBtn);

  // 実行中かつ未実行の変更がある時だけ、再生ボタンにさりげない差分ドットを出す。
  const updateRunStale = () => {
    runStopBtn.classList.toggle("stale", isRunning && staleSinceRun);
  };

  const projectNameInput = document.createElement("input");
  projectNameInput.id = "project-name";
  projectNameInput.type = "text";
  projectNameInput.value = shareButton.getProjectName();
  projectNameInput.spellcheck = false;
  projectNameInput.setAttribute("aria-label", "プロジェクト名");
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
    openProcessingButton.detach();
    projectNameInput.value = newName;
    runCode();
  };

  // プレビュー
  const preview = new Preview(app);

  // コンソールパネル（メッセージはプレビュー iframe からのもののみ受け付ける）
  const consolePanel = new ConsolePanel(
    app,
    (source) => source === preview.getContentWindow()
  );

  // 実行関数
  const runCode = () => {
    snapshot();
    consolePanel.clear();
    preview.run(files, {
      transition: currentSettings.previewTransition,
      durationMs: currentSettings.previewTransitionMs,
    });
    isRunning = true;
    // 今のコードを実行したので、未実行の変更は無くなった。
    staleSinceRun = false;
    runStopBtn.innerHTML = ICONS.stop;
    runStopBtn.querySelector("svg")?.setAttribute("aria-hidden", "true");
    setBtnLabel(runStopBtn, STOP_LABEL);
    updateRunStale();
    // Gist 作成済みなら、実行のたびに（変更があれば）自動更新する
    shareButton.scheduleAutoSave();
  };

  const stopCode = () => {
    preview.stop();
    isRunning = false;
    runStopBtn.innerHTML = ICONS.play;
    runStopBtn.querySelector("svg")?.setAttribute("aria-hidden", "true");
    setBtnLabel(runStopBtn, RUN_LABEL);
    // 停止中は「実行中の表示が古い」概念が無いのでドットを消す。
    updateRunStale();
  };

  runStopBtn.onclick = () => {
    if (isRunning) {
      stopCode();
    } else {
      runCode();
    }
  };

  // エディタ
  const editor = createEditor(
    document.body,
    files[currentFile],
    LANGUAGES[currentFile],
    runCode,
    initialSettings
  );

  // エディタ変更時にシェアボタン / OpenProcessing ボタンの状態を更新し、
  // 実行中なら「未実行の変更あり」をさりげなく示す。
  editor.onDidChange(() => {
    shareButton.markDirty();
    openProcessingButton.markDirty();
    staleSinceRun = true;
    updateRunStale();
  });

  // 音声ビート可視化コントローラ（既定 OFF・トグルで権限取得）
  const audioReactive = new AudioReactiveController(
    app,
    initialSettings.beatPattern
  );
  audioReactive.setSensitivity(initialSettings.beatSensitivity);
  audioReactive.configure({
    bandMinHz: initialSettings.beatBandMinHz,
    bandMaxHz: initialSettings.beatBandMaxHz,
    floor: initialSettings.beatFloor,
    refractoryMs: initialSettings.beatMinIntervalMs,
  });
  audioReactive.setStatusListener((s) => {
    const sourceLabel = s.source === "mic" ? "Mic" : "Tab audio";
    const text =
      s.state === "on"
        ? `On (${sourceLabel})`
        : s.state === "starting"
          ? "Starting…"
          : s.state === "error"
            ? (s.message ?? "Couldn't start")
            : "Off";
    // on のときだけトグルを ON 表示に同期、それ以外は OFF に戻す。
    settingsPanel.setAudioStatus(text, s.state === "on");
  });

  // 設定変更時にエディタへ反映し、音声の音源/パターンを同期する。
  // 最新設定は runCode のトランジション参照用にも保持する。
  settingsPanel.setOnChange((settings: EditorSettings) => {
    currentSettings = settings;
    editor.applySettings(settings);
    audioReactive.setSensitivity(settings.beatSensitivity);
    audioReactive.configure({
      bandMinHz: settings.beatBandMinHz,
      bandMaxHz: settings.beatBandMaxHz,
      floor: settings.beatFloor,
      refractoryMs: settings.beatMinIntervalMs,
    });
    audioReactive.setPattern(settings.beatPattern);
    void audioReactive.setSource(settings.audioSource);
  });

  // 音声トグル: ON で権限取得して開始、OFF で停止
  settingsPanel.setOnAudioToggle((enabled, settings) => {
    if (enabled) void audioReactive.enable(settings.audioSource);
    else audioReactive.disable();
  });

  // 設定パネルでトークンを削除したら、両ボタンの接続ドットを消灯させる
  settingsPanel.setOnTokensCleared(() => {
    void shareButton.refreshAuth();
    void openProcessingButton.refreshAuth();
  });

  // 別スケッチ（サンプル / Gist 取り込み）を読み込む共通処理。
  // 既存 Gist / OpenProcessing 連携は切り離し、自動更新で上書きしない。
  const loadFiles = (newFiles: Files) => {
    files.html = newFiles.html;
    files.css = newFiles.css;
    files.js = newFiles.js;
    editor.setValue(files[currentFile]);
    shareButton.detachGist();
    openProcessingButton.detach();
    runCode();
  };

  // サンプル選択時にファイルを読み込み
  samplesPanel.setOnSelect((sampleFiles) => loadFiles(sampleFiles));

  // Gist 取り込み時：内容を読み込み、プロジェクト名も復元する（新規扱い）。
  importButton.setOnImport((importedFiles, projectName) => {
    loadFiles(importedFiles);
    shareButton.setProjectName(projectName);
    projectNameInput.value = projectName;
  });

  // タブ切り替え
  const switchTab = (type: FileType) => {
    if (type === currentFile) return;

    // 現在のファイル内容を保存
    snapshot();

    // タブのアクティブ状態を更新
    tabButtons[currentFile].className = "";
    tabButtons[currentFile].setAttribute("aria-selected", "false");
    tabButtons[type].className = "active";
    tabButtons[type].setAttribute("aria-selected", "true");

    // エディタの内容と言語を切り替え
    currentFile = type;
    editor.setValue(files[type]);
    editor.setLanguage(LANGUAGES[type]);
  };

  // 初回実行
  runCode();
}

init().catch((e) => {
  console.error("初期化に失敗しました", e);
});
