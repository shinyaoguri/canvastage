import { getTransition, type PreviewTransition } from "./transitions";

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
  return pattern.test(html)
    ? html.replace(pattern, replacement)
    : fallback(html);
}

// snippet を </tag> の直前に、無ければ末尾に挿入する fallback を作る
function injectBefore(closingTag: "head" | "body", snippet: string) {
  const re = new RegExp(`</${closingTag}>`, "i");
  return (html: string): string =>
    re.test(html)
      ? html.replace(re, `${snippet}</${closingTag}>`)
      : html + snippet;
}

export function buildHtml(files: Files): string {
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

// 切り替えアニメーション用のオプション（main から設定値を渡す）。
export interface RunOptions {
  transition?: string; // トランジション id（"none" なら即時）
  durationMs?: number; // アニメーション時間
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

const nextPaint = (): Promise<void> =>
  new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r()))
  );

export class Preview {
  // ダブルバッファ: 2 枚の iframe を持ち、トランジション時は裏で新フレームを
  // 起動してからアニメーションで入れ替える。アクティブな方に id="preview-frame"
  // を付け替える（入力ブリッジ/コンソール検証/E2E はこれを参照する）。
  private frames: [HTMLIFrameElement, HTMLIFrameElement];
  private activeIndex = 0;
  // 入力ブリッジで document/window に張るリスナをまとめて外せるようにする。
  private bridgeController = new AbortController();
  // 一度でも実行したか（初回は遷移元が無いので即時表示）。
  private hasRendered = false;
  // 進行中のトランジション Animation 群（中断/再実行用）。
  private transitionAnims: Animation[] | null = null;
  // run のたびに増やし、非同期処理が古い実行のものか判定する世代カウンタ。
  private gen = 0;

  constructor(container: HTMLElement) {
    this.frames = [this.createFrame(), this.createFrame()];
    this.frames.forEach((f) => container.appendChild(f));
    // 初期: frame[0] をアクティブ、frame[1] は隠す。
    this.frames[0].id = "preview-frame";
    this.frames[1].style.visibility = "hidden";

    // 親ウィンドウの入力イベントをiframeに転送
    this.setupInputBridge();
  }

  private createFrame(): HTMLIFrameElement {
    const iframe = document.createElement("iframe");
    iframe.className = "preview-frame";
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
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
    // webcam / ML 系サンプルのためにメディア・センサー機能を委譲する
    // （Permissions Policy は sandbox とは独立して制御される）。
    iframe.setAttribute(
      "allow",
      "camera; microphone; midi; accelerometer; gyroscope; xr-spatial-tracking"
    );
    return iframe;
  }

  private get active(): HTMLIFrameElement {
    return this.frames[this.activeIndex];
  }
  private get inactive(): HTMLIFrameElement {
    return this.frames[this.activeIndex ^ 1];
  }

  private setupInputBridge(): void {
    const signal = this.bridgeController.signal;
    const post = (data: Record<string, unknown>) => {
      const win = this.active.contentWindow;
      if (!win) return;
      win.postMessage(data, "*");
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
    document.addEventListener(
      "mousemove",
      (e) => sendMouseEvent(e, "mousemove"),
      {
        signal,
      }
    );
    document.addEventListener(
      "mousedown",
      (e) => sendMouseEvent(e, "mousedown"),
      {
        signal,
      }
    );
    document.addEventListener("mouseup", (e) => sendMouseEvent(e, "mouseup"), {
      signal,
    });

    // ホイールイベント
    document.addEventListener(
      "wheel",
      (e) => {
        post({ type: "wheel", deltaY: e.deltaY });
      },
      { signal }
    );

    // キーボードイベント（captureフェーズでMonaco Editorより先にキャプチャ）
    const sendKeyEvent = (e: KeyboardEvent, eventType: string) => {
      post({
        type: "keyboard",
        eventType,
        key: e.key,
        keyCode: e.keyCode,
      });
    };
    window.addEventListener("keydown", (e) => sendKeyEvent(e, "keydown"), {
      capture: true,
      signal,
    });
    window.addEventListener("keyup", (e) => sendKeyEvent(e, "keyup"), {
      capture: true,
      signal,
    });

    // ウィンドウリサイズ
    const sendResize = () => {
      post({
        type: "resize",
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener("resize", sendResize, { signal });
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
    document.addEventListener(
      "touchstart",
      (e) => sendTouchEvent(e, "touchstart"),
      { signal }
    );
    document.addEventListener(
      "touchmove",
      (e) => sendTouchEvent(e, "touchmove"),
      {
        signal,
      }
    );
    document.addEventListener(
      "touchend",
      (e) => sendTouchEvent(e, "touchend"),
      {
        signal,
      }
    );
  }

  // コンソールパネルが postMessage の送信元を検証するために使う。
  getContentWindow(): Window | null {
    return this.active.contentWindow;
  }

  // スケッチを実行する。トランジション指定があり、かつ既に何か実行中なら、
  // 裏フレームで新スケッチを起動してからアニメーションで入れ替える。
  run(files: Files, options: RunOptions = {}): void {
    const myGen = ++this.gen;
    const html = buildHtml(files);
    const transition =
      options.transition && options.durationMs
        ? getTransition(options.transition)
        : null;
    const useTransition =
      transition !== null &&
      (options.durationMs ?? 0) > 0 &&
      this.hasRendered &&
      !prefersReducedMotion();

    if (!useTransition) {
      // 即時切替（従来動作）。進行中の遷移があれば打ち切り、アクティブを中立表示・
      // 非アクティブを隠した状態にしてから差し替える。
      this.finishTransition();
      this.resetStyles(this.active);
      this.active.style.visibility = "visible";
      this.inactive.style.visibility = "hidden";
      this.active.srcdoc = html;
      this.hasRendered = true;
      return;
    }

    void this.runWithTransition(html, transition, options.durationMs!, myGen);
  }

  private async runWithTransition(
    html: string,
    transition: PreviewTransition,
    durationMs: number,
    myGen: number
  ): Promise<void> {
    // 進行中の遷移があれば打ち切る（forwards fill を残さない）。
    this.finishTransition();

    const outgoing = this.active;
    const incoming = this.inactive;

    // 前回の遷移のインラインスタイルを両フレームから消してから組み立てる。
    this.resetStyles(outgoing);
    this.resetStyles(incoming);

    // 初期フラッシュ防止のため、初期状態（重なり順・clip/opacity）を設定してから
    // 可視化＆ロードする。重なり順は演出ごとに setup が決める。
    incoming.style.pointerEvents = "none";
    incoming.style.visibility = "visible";
    transition.setup(outgoing, incoming);

    await this.loadSrcdoc(incoming, html);
    if (this.gen !== myGen) return; // より新しい run に追い越された
    await nextPaint(); // 最初の 1 フレームを描かせてから遷移する
    if (this.gen !== myGen) return;

    // 入力/コンソールの宛先を新フレームへ切り替える（id も付け替え）。
    this.activeIndex ^= 1;
    incoming.id = "preview-frame";
    outgoing.removeAttribute("id");

    const anims = transition.run(outgoing, incoming, durationMs);
    this.transitionAnims = anims;
    try {
      await Promise.all(anims.map((a) => a.finished));
    } catch {
      /* cancel された場合は無視 */
    }
    if (this.gen !== myGen) return; // 追い越された場合は後発の run が片付ける
    this.transitionAnims = null;
    this.cleanupAfterTransition(outgoing, incoming, anims);
    this.hasRendered = true;
  }

  // 進行中のトランジションを打ち切る（再実行/即時切替の前処理）。
  // cancel して forwards fill を解除する（次の遷移に効果を持ち越さないため）。
  private finishTransition(): void {
    if (this.transitionAnims) {
      this.transitionAnims.forEach((a) => a.cancel());
      this.transitionAnims = null;
    }
  }

  // フレームの遷移用インラインスタイルを中立に戻す（visibility は触らない）。
  private resetStyles(frame: HTMLIFrameElement): void {
    frame.style.opacity = "";
    frame.style.transform = "";
    frame.style.clipPath = "";
    frame.style.zIndex = "";
  }

  // 遷移後の後始末: アニメーションの forwards fill を解除し、旧フレームを停止・隠す。
  private cleanupAfterTransition(
    outgoing: HTMLIFrameElement,
    incoming: HTMLIFrameElement,
    anims: Animation[]
  ): void {
    // forwards fill を解除（clip/opacity 等を次回の遷移へ持ち越さない）。
    anims.forEach((a) => a.cancel());

    // 新フレームを通常表示の中立状態へ。
    this.resetStyles(incoming);
    incoming.style.pointerEvents = "";
    incoming.style.visibility = "visible";

    // 旧フレームは停止して隠す。
    this.resetStyles(outgoing);
    outgoing.srcdoc = "";
    outgoing.style.pointerEvents = "";
    outgoing.style.visibility = "hidden";
  }

  private loadSrcdoc(frame: HTMLIFrameElement, html: string): Promise<void> {
    return new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        frame.removeEventListener("load", finish);
        resolve();
      };
      frame.addEventListener("load", finish);
      frame.srcdoc = html;
      // load が来ないケースのフォールバック。
      window.setTimeout(finish, 1500);
    });
  }

  stop(): void {
    this.finishTransition();
    this.active.srcdoc = "";
  }

  // 入力ブリッジのリスナを解除し iframe を取り除く。
  // 現状は単一ライフサイクルだが、Preview を再生成可能にした際の leak を防ぐ。
  dispose(): void {
    this.bridgeController.abort();
    this.frames.forEach((f) => f.remove());
  }
}
