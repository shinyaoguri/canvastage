export interface Files {
  html: string;
  css: string;
  js: string;
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
  // canvasのローカル座標に変換するヘルパー
  function toCanvasCoords(clientX, clientY) {
    var canvas = document.querySelector('canvas');
    if (canvas) {
      var rect = canvas.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    }
    return { x: clientX, y: clientY };
  }

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
        var pos = toCanvasCoords(data.x, data.y);
        // 前回のマウス位置を保存
        window._parentInput.pmouse.x = window._parentInput.mouse.x;
        window._parentInput.pmouse.y = window._parentInput.mouse.y;
        // 現在位置を更新
        window._parentInput.mouse.x = pos.x;
        window._parentInput.mouse.y = pos.y;
        // p5.js のグローバル変数を即座に更新
        if (typeof window.mouseX !== 'undefined') {
          window.mouseX = pos.x;
          window.mouseY = pos.y;
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
        window._parentInput.touches = data.touches.map(function(t) {
          var tp = toCanvasCoords(t.x, t.y);
          return { x: tp.x, y: tp.y, id: t.id };
        });
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

// pattern に一致すれば replacement で置換し、一致しなければ fallback を呼ぶ。
// ユーザーが index.html を編集してプレースホルダ（style.css の link や
// sketch.js の script、<head> など）を変更・削除しても、CSS / JS / ブリッジが
// 無言で消えないようにする。
function replaceOrElse(
  html: string,
  pattern: RegExp,
  replacement: string,
  fallback: (html: string) => string
): string {
  return pattern.test(html) ? html.replace(pattern, replacement) : fallback(html);
}

// snippet を </tag> の直前に、無ければ末尾に挿入する fallback を作る
function injectBefore(closingTag: "head" | "body", snippet: string) {
  const re = new RegExp(`</${closingTag}>`, "i");
  return (html: string): string =>
    re.test(html) ? html.replace(re, `${snippet}</${closingTag}>`) : html + snippet;
}

function buildHtml(files: Files): string {
  let html = files.html;

  const styleTag = `<style>\n${files.css}\n</style>`;
  const sketchTag = `<script>\n${files.js}\n</script>`;
  const bridges = `${CONSOLE_BRIDGE_SCRIPT}${INPUT_BRIDGE_SCRIPT}`;

  // コンソールブリッジと入力ブリッジを最優先で読み込む（p5.js より前）。
  // <head> が無ければ <html> 直後、それも無ければ先頭に挿入する。
  html = replaceOrElse(html, /<head>/i, `<head>${bridges}`, (h) =>
    /<html[^>]*>/i.test(h)
      ? h.replace(/<html[^>]*>/i, (m) => `${m}${bridges}`)
      : bridges + h
  );

  // style.css の link を inline style に置換。無ければ </head> 前に挿入。
  html = replaceOrElse(
    html,
    /<link\s+rel="stylesheet"\s+href="style\.css"\s*\/?>/i,
    styleTag,
    injectBefore("head", styleTag)
  );

  // sketch.js の script を inline script に置換。無ければ </body> 前に挿入。
  html = replaceOrElse(
    html,
    /<script\s+src="sketch\.js"\s*><\/script>/i,
    sketchTag,
    injectBefore("body", sketchTag)
  );

  return html;
}

export class Preview {
  private iframe: HTMLIFrameElement;

  constructor(container: HTMLElement) {
    this.iframe = document.createElement("iframe");
    this.iframe.id = "preview-frame";
    // ⚠️ 意図的な設計判断 — allow-same-origin は必須。外さないこと。
    //
    // 「同一オリジンの iframe で任意コードを実行するのは危険」に見え、
    // セキュリティ強化として allow-same-origin を外したくなるが、それは過去に
    // 実際に行って webcam / 音声サンプルを壊した（commit 88374f5 で revert）。
    //
    // 不透明オリジン（allow-scripts のみ）にすると:
    //   - getUserMedia が権限を取得できず webcam / ML サンプルが動かない
    //   - 親のクリックの user activation が伝播せず Web Audio（tone-synth）が鳴らない
    //
    // トレードオフは承知の上で受容している: 同一オリジンのためスケッチコードは
    // window.parent 経由で親の IndexedDB（gist スコープの GitHub トークン）や DOM に
    // 到達できる。これは「信頼できないコードを実行しない」前提で許容しており、
    // UI（設定パネル下部）と README に明記済み。スコープは gist 限定で
    // リポジトリ等には影響しない。
    //
    // 真にコードを隔離したくなったら、sandbox を強める前に「プレビューを別オリジンで
    // 配信する」か「トークンを httpOnly Cookie + サーバ経由にする」こと。詳細は
    // CLAUDE.md の "Design decisions" を参照。
    //
    // top-navigation / popups / forms は引き続きブロックして最小限の保護を残す。
    this.iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
    // webcam / ML 系サンプルのためにメディア・センサー機能を委譲する
    // （Permissions Policy は sandbox とは独立して制御される）。
    this.iframe.setAttribute(
      "allow",
      "camera; microphone; midi; accelerometer; gyroscope; xr-spatial-tracking"
    );
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
