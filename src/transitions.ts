// プレビュー再実行時のページ切り替え演出（パワポ/Keynote 的なトランジション）。
//
// outgoing / incoming は全面に重なるレイヤ（プレビュー iframe）。現在
// 「outgoing 表示・incoming 隠れ」の状態から「incoming 表示」へアニメーション
// する。Web Animations API の Animation を返し、呼び出し側（Preview）が完了
// 待ち・中断（finish/cancel）できるようにする。
//
// 新しい演出はこのレジストリに足すだけで設定の選択肢に並ぶ（ビートのパターンと
// 同じ方式）。

export interface PreviewTransition {
  readonly id: string;
  readonly name: string;
  // 遷移開始前の初期状態を両レイヤに設定する（重なり順・初期 clip/opacity 等）。
  // どちらを上に重ねるか・どちらを動かすかは演出ごとに決める。
  //
  // 重要: 新フレーム(incoming)はロード直後でまだ最初の 1 フレームを描けていない
  // ことがある。新フレームを「上に出す」演出（cover 系）は一瞬黒く見えうるため、
  // 露出（reveal）系は旧フレーム(outgoing, 描画済み)を上に置いて剥がす方式にする。
  setup(outgoing: HTMLElement, incoming: HTMLElement): void;
  // setup の状態から最終状態へアニメーションする Animation 群を返す。
  run(
    outgoing: HTMLElement,
    incoming: HTMLElement,
    durationMs: number
  ): Animation[];
}

const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";
const opts = (durationMs: number): KeyframeAnimationOptions => ({
  duration: durationMs,
  easing: EASE,
  fill: "forwards",
});

// クロスフェード（ディゾルブ）。新フレームを上に重ね、フェードインしながら
// 旧フレームをフェードアウト。
const dissolve: PreviewTransition = {
  id: "dissolve",
  name: "Dissolve",
  setup(_outgoing, incoming) {
    incoming.style.zIndex = "1";
    incoming.style.opacity = "0";
  },
  run(outgoing, incoming, dur) {
    return [
      incoming.animate([{ opacity: 0 }, { opacity: 1 }], opts(dur)),
      outgoing.animate([{ opacity: 1 }, { opacity: 0 }], opts(dur)),
    ];
  },
};

// ワイプ（露出系）。「描画済みの旧フレームを上に置いて剥がし、下で待機している
// 新フレームを露出する」方式。新フレームを上に出すと最初の 1 フレーム未描画で
// 一瞬黒くなるため、左右どちらも旧フレームを剥がす同じ方式に統一する。
//
// 旧フレームを左から削る（inset の left を伸ばす）と、ワイプの境界は左→右へ動き、
// 新フレームが左から現れる = Wipe (right)。右から削れば逆 = Wipe (left)。
function makeWipe(
  id: string,
  name: string,
  fromLeft: boolean
): PreviewTransition {
  const end = fromLeft ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)";
  return {
    id,
    name,
    setup(outgoing, incoming) {
      incoming.style.zIndex = "0";
      outgoing.style.zIndex = "1";
    },
    run(outgoing, _incoming, dur) {
      return [
        outgoing.animate(
          [{ clipPath: "inset(0 0 0 0)" }, { clipPath: end }],
          opts(dur)
        ),
      ];
    },
  };
}

const wipeRight = makeWipe("wipe-right", "Wipe (right)", true);
const wipeLeft = makeWipe("wipe-left", "Wipe (left)", false);

// スライド（カバー系）。新フレームを上に重ね、画面外から滑り込ませる。旧フレームは
// 固定（動かすと元の Canvas がずれて見えるため）。名前は動く向き。
// Slide (left) = 右端から入って左へ、Slide (right) = 左端から入って右へ。
function makeSlide(
  id: string,
  name: string,
  startX: string
): PreviewTransition {
  return {
    id,
    name,
    setup(_outgoing, incoming) {
      incoming.style.zIndex = "1";
      incoming.style.transform = `translateX(${startX})`;
    },
    run(_outgoing, incoming, dur) {
      return [
        incoming.animate(
          [
            { transform: `translateX(${startX})` },
            { transform: "translateX(0)" },
          ],
          opts(dur)
        ),
      ];
    },
  };
}

const slideLeft = makeSlide("slide-left", "Slide (left)", "100%");
const slideRight = makeSlide("slide-right", "Slide (right)", "-100%");

// 新フレームが少し拡大しながらフェードイン（ズーム）。
const zoom: PreviewTransition = {
  id: "zoom",
  name: "Zoom",
  setup(_outgoing, incoming) {
    incoming.style.zIndex = "1";
    incoming.style.opacity = "0";
    incoming.style.transform = "scale(1.06)";
  },
  run(outgoing, incoming, dur) {
    return [
      incoming.animate(
        [
          { opacity: 0, transform: "scale(1.06)" },
          { opacity: 1, transform: "scale(1)" },
        ],
        opts(dur)
      ),
      outgoing.animate([{ opacity: 1 }, { opacity: 0 }], opts(dur)),
    ];
  },
};

const TRANSITIONS: Record<string, PreviewTransition> = {
  dissolve,
  "slide-left": slideLeft,
  "slide-right": slideRight,
  "wipe-left": wipeLeft,
  "wipe-right": wipeRight,
  zoom,
};

export const NO_TRANSITION = "none";

// 設定 select 用の選択肢（先頭は「なし」＝即時切替）。
export const TRANSITION_OPTIONS: { value: string; label: string }[] = [
  { value: NO_TRANSITION, label: "None" },
  ...Object.values(TRANSITIONS).map((t) => ({ value: t.id, label: t.name })),
];

export function getTransition(id: string): PreviewTransition | null {
  return TRANSITIONS[id] ?? null;
}
