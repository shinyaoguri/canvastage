# canvastage

## 概要
p5.jsを用いたライブコーディング・VJツール。
- Control Window (操作系): エディタ、スロット管理、プレビュー、パラメータ調整。
- Stage Window (投影系): 高解像度レンダリング、WebGPUコンポジット、フルスクリーン出力。

## 技術スタック
- Package manager: npm
- Frontend: Next.js (App Router) + Tailwind CSS
- State Management: Zustand (シンプルかつ高速な状態管理)
- Editor: @monaco-editor/react
- Communication: Broadcast Channel API
- Graphics: p5.js (Instance Mode) + WebGPU (Compositor)
- Concurrency: Web Workers (OffscreenCanvas)

## 実装フェーズ・ロードマップ

### Phase 1: Bridge & Sync (基盤構築)
まずは、2つのウィンドウ間でコードを同期する「神経系」を作ります。
- Shared Worker/Broadcast Channelのセットアップ: useBroadcastChannel カスタムフックの実装。
- Dual Window Routing: /control と /stage のページ作成。
- Simple Sync: エディタで打った文字列が、別ウィンドウのコンソールにリアルタイムで届くことを確認。

### Phase 2: Isolated Runner (描画エンジンの分離)
メインスレッドを止めないための「実行環境」を作ります。
- P5 Worker Thread: p5.jsをWeb Worker内で動かすボイラープレートの作成。
- Dynamic Execution: 受信した文字列を new Function() または URL.createObjectURL で実行可能なモジュールに変換。
- Offscreen Rendering: OffscreenCanvas を使って、Workerからメインウィンドウへ描画結果を転送。

### Phase 3: Slot & Mixer UI (VJ機能)
複数のスケッチを操る「楽器としてのUI」を作ります。
- Slot Architecture: 複数のエディタ・インスタンスを管理するデータ構造（Array of Slots）の定義。
- Mini-Preview: 各スロットの描画結果を操作画面に小さく表示（負荷軽減のため低解像度化）。
- Mixing Engine (WebGL/WebGPU): 2つのスロットを mix(A, B, ratio) するコンポジターの実装。

### Phase 4: Parameter Binding (演出の自動化)
コードとUIを繋ぐ「直感的な操作」を追加します。
- AST Parsing: コード内の特定のコメント（例: // @slider）を解析し、UIスライダーを自動生成。
- Global Clock Sync: BPMや経過時間を全スロットで共有する仕組み。
- Post-Processing: 全体にかけるシェーダー（Grain, VHS, Glitchなど）の実装。