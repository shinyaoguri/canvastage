import { parseDirectives, LibraryDirective } from "./directive-parser";
import { resolveLibraryUrl } from "./library-registry";

export interface Files {
  html: string;
  css: string;
  js: string;
}

function buildLibraryScripts(directives: LibraryDirective[]): string {
  const scripts: string[] = [];

  for (const directive of directives) {
    let url: string | null = null;

    if (directive.url) {
      // 直接URL指定
      url = directive.url;
    } else {
      // レジストリから解決
      url = resolveLibraryUrl(directive.name, directive.version);
    }

    if (url) {
      scripts.push(`<script src="${url}"></script>`);
    } else {
      // 未知のライブラリはjsdelivrから直接取得を試みる
      const version = directive.version || "latest";
      scripts.push(`<script src="https://cdn.jsdelivr.net/npm/${directive.name}@${version}"></script>`);
    }
  }

  return scripts.join("\n");
}

// コンソール出力を親ウィンドウに転送するスクリプト
const CONSOLE_BRIDGE_SCRIPT = `
<script>
(function() {
  const originalConsole = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    info: console.info.bind(console),
    debug: console.debug.bind(console)
  };

  function sendToParent(level, args) {
    const message = args.map(arg => {
      if (arg === null) return 'null';
      if (arg === undefined) return 'undefined';
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    window.parent.postMessage({
      type: 'console',
      level: level,
      message: message,
      timestamp: Date.now()
    }, '*');
  }

  console.log = function(...args) {
    originalConsole.log(...args);
    sendToParent('log', args);
  };

  console.warn = function(...args) {
    originalConsole.warn(...args);
    sendToParent('warn', args);
  };

  console.error = function(...args) {
    originalConsole.error(...args);
    sendToParent('error', args);
  };

  console.info = function(...args) {
    originalConsole.info(...args);
    sendToParent('info', args);
  };

  console.debug = function(...args) {
    originalConsole.debug(...args);
    sendToParent('debug', args);
  };

  // エラーハンドリング
  window.onerror = function(message, source, lineno, colno, error) {
    sendToParent('error', [message + (lineno ? ' (line ' + lineno + ')' : '')]);
    return false;
  };

  window.onunhandledrejection = function(event) {
    sendToParent('error', ['Unhandled Promise rejection: ' + event.reason]);
  };
})();
</script>
`;

// 親ウィンドウからの入力イベントをp5.jsに反映するブリッジスクリプト
const INPUT_BRIDGE_SCRIPT = `
<script>
(function() {
  // 親から受け取った入力状態を保持
  window._parentInput = {
    mouse: { x: 0, y: 0, pressed: false, button: 0 },
    pmouse: { x: 0, y: 0 },
    keyboard: { key: '', keyCode: 0, isPressed: false },
    window: { width: window.innerWidth, height: window.innerHeight },
    touches: []
  };

  window.addEventListener('message', function(e) {
    if (!e.data || !e.data.type) return;
    var data = e.data;

    switch (data.type) {
      case 'mouse':
        // 前回のマウス位置を保存
        window._parentInput.pmouse.x = window._parentInput.mouse.x;
        window._parentInput.pmouse.y = window._parentInput.mouse.y;
        // 現在位置を更新
        window._parentInput.mouse.x = data.x;
        window._parentInput.mouse.y = data.y;
        // p5.js のグローバル変数を即座に更新
        if (typeof window.mouseX !== 'undefined') {
          window.mouseX = data.x;
          window.mouseY = data.y;
        }
        if (data.eventType === 'mousedown') {
          window._parentInput.mouse.pressed = true;
          window._parentInput.mouse.button = data.button;
          if (typeof window.mouseIsPressed !== 'undefined') {
            window.mouseIsPressed = true;
            window.mouseButton = data.button === 0 ? window.LEFT :
                                 data.button === 2 ? window.RIGHT : window.CENTER;
          }
          // p5.js のコールバックを呼び出し
          if (typeof window.mousePressed === 'function') window.mousePressed();
        } else if (data.eventType === 'mouseup') {
          window._parentInput.mouse.pressed = false;
          if (typeof window.mouseIsPressed !== 'undefined') {
            window.mouseIsPressed = false;
          }
          if (typeof window.mouseReleased === 'function') window.mouseReleased();
          if (typeof window.mouseClicked === 'function') window.mouseClicked();
        } else if (data.eventType === 'mousemove') {
          if (window._parentInput.mouse.pressed && typeof window.mouseDragged === 'function') {
            window.mouseDragged();
          } else if (typeof window.mouseMoved === 'function') {
            window.mouseMoved();
          }
        }
        break;

      case 'wheel':
        // mouseWheel イベントを発火
        if (typeof window.mouseWheel === 'function') {
          window.mouseWheel({ delta: data.deltaY });
        }
        break;

      case 'keyboard':
        window._parentInput.keyboard.key = data.key;
        window._parentInput.keyboard.keyCode = data.keyCode;
        if (data.eventType === 'keydown') {
          window._parentInput.keyboard.isPressed = true;
          // p5.js のコールバックを呼び出し
          if (typeof window.keyPressed === 'function') window.keyPressed();
          if (typeof window.keyTyped === 'function' && data.key.length === 1) window.keyTyped();
        } else if (data.eventType === 'keyup') {
          window._parentInput.keyboard.isPressed = false;
          if (typeof window.keyReleased === 'function') window.keyReleased();
        }
        break;

      case 'resize':
        window._parentInput.window.width = data.width;
        window._parentInput.window.height = data.height;
        break;

      case 'touch':
        window._parentInput.touches = data.touches;
        if (data.eventType === 'touchstart' && typeof window.touchStarted === 'function') {
          window.touchStarted();
        } else if (data.eventType === 'touchmove' && typeof window.touchMoved === 'function') {
          window.touchMoved();
        } else if (data.eventType === 'touchend' && typeof window.touchEnded === 'function') {
          window.touchEnded();
        }
        break;
    }
  });

  // requestAnimationFrame をフックしてp5.jsのグローバル変数を毎フレーム更新
  var originalRAF = window.requestAnimationFrame;
  window.requestAnimationFrame = function(callback) {
    return originalRAF.call(window, function(timestamp) {
      var input = window._parentInput;

      // マウス関連
      if (typeof window.mouseX !== 'undefined') {
        window.mouseX = input.mouse.x;
        window.mouseY = input.mouse.y;
        window.pmouseX = input.pmouse.x;
        window.pmouseY = input.pmouse.y;
        window.mouseIsPressed = input.mouse.pressed;
        window.mouseButton = input.mouse.button === 0 ? window.LEFT :
                             input.mouse.button === 2 ? window.RIGHT : window.CENTER;
      }

      // キーボード関連
      if (typeof window.key !== 'undefined') {
        window.key = input.keyboard.key;
        window.keyCode = input.keyboard.keyCode;
        window.keyIsPressed = input.keyboard.isPressed;
      }

      // ウィンドウサイズ
      if (typeof window.windowWidth !== 'undefined') {
        window.windowWidth = input.window.width;
        window.windowHeight = input.window.height;
      }

      // タッチ
      if (typeof window.touches !== 'undefined') {
        window.touches = input.touches;
      }

      callback(timestamp);
    });
  };
})();
</script>
`;

function buildHtml(files: Files): string {
  let html = files.html;

  // style.css を inline style に置換
  html = html.replace(
    /<link\s+rel="stylesheet"\s+href="style\.css"\s*\/?>/i,
    `<style>\n${files.css}\n</style>`
  );

  // @use ディレクティブを解析してライブラリスクリプトを生成
  const directives = parseDirectives(files.js);
  const libraryScripts = buildLibraryScripts(directives);

  // コンソールブリッジと入力ブリッジスクリプトを<head>の直後に挿入（p5.jsより前に読み込む）
  html = html.replace(/<head>/i, `<head>${CONSOLE_BRIDGE_SCRIPT}${INPUT_BRIDGE_SCRIPT}`);

  // sketch.js を inline script に置換（ライブラリスクリプトを先に挿入）
  html = html.replace(
    /<script\s+src="sketch\.js"\s*><\/script>/i,
    `${libraryScripts}\n<script>\n${files.js}\n</script>`
  );

  return html;
}

export class Preview {
  private iframe: HTMLIFrameElement;

  constructor(container: HTMLElement) {
    this.iframe = document.createElement("iframe");
    this.iframe.id = "preview-frame";
    container.appendChild(this.iframe);

    // 親ウィンドウの入力イベントをiframeに転送
    this.setupInputBridge();
  }

  private setupInputBridge(): void {
    const post = (data: Record<string, unknown>) => {
      if (!this.iframe.contentWindow) return;
      this.iframe.contentWindow.postMessage(data, "*");
    };

    // マウスイベント
    const sendMouseEvent = (e: MouseEvent, eventType: string) => {
      post({
        type: "mouse",
        eventType,
        x: e.clientX,
        y: e.clientY,
        button: e.button,
      });
    };
    document.addEventListener("mousemove", (e) => sendMouseEvent(e, "mousemove"));
    document.addEventListener("mousedown", (e) => sendMouseEvent(e, "mousedown"));
    document.addEventListener("mouseup", (e) => sendMouseEvent(e, "mouseup"));

    // ホイールイベント
    document.addEventListener("wheel", (e) => {
      post({ type: "wheel", deltaY: e.deltaY });
    });

    // キーボードイベント（captureフェーズでMonaco Editorより先にキャプチャ）
    const sendKeyEvent = (e: KeyboardEvent, eventType: string) => {
      post({
        type: "keyboard",
        eventType,
        key: e.key,
        keyCode: e.keyCode,
      });
    };
    window.addEventListener("keydown", (e) => sendKeyEvent(e, "keydown"), true);
    window.addEventListener("keyup", (e) => sendKeyEvent(e, "keyup"), true);

    // ウィンドウリサイズ
    const sendResize = () => {
      post({
        type: "resize",
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener("resize", sendResize);
    // 初期サイズも送信
    sendResize();

    // タッチイベント
    const sendTouchEvent = (e: TouchEvent, eventType: string) => {
      const touches = Array.from(e.touches).map((t) => ({
        x: t.clientX,
        y: t.clientY,
        id: t.identifier,
      }));
      post({ type: "touch", eventType, touches });
    };
    document.addEventListener("touchstart", (e) => sendTouchEvent(e, "touchstart"));
    document.addEventListener("touchmove", (e) => sendTouchEvent(e, "touchmove"));
    document.addEventListener("touchend", (e) => sendTouchEvent(e, "touchend"));
  }

  run(files: Files): void {
    this.iframe.srcdoc = buildHtml(files);
  }

  stop(): void {
    this.iframe.srcdoc = "";
  }
}
