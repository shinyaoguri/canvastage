export interface LibraryInfo {
  name: string;
  cdnUrl: string;
  defaultVersion: string;
}

const LIBRARY_REGISTRY: Record<string, LibraryInfo> = {
  // 3D
  three: {
    name: "three",
    cdnUrl: "https://cdn.jsdelivr.net/npm/three@{version}/build/three.min.js",
    defaultVersion: "0.160.0",
  },

  // アニメーション
  gsap: {
    name: "gsap",
    cdnUrl: "https://cdn.jsdelivr.net/npm/gsap@{version}/dist/gsap.min.js",
    defaultVersion: "3.12.5",
  },
  anime: {
    name: "animejs",
    cdnUrl: "https://cdn.jsdelivr.net/npm/animejs@{version}/lib/anime.min.js",
    defaultVersion: "3.2.2",
  },

  // オーディオ
  tone: {
    name: "tone",
    cdnUrl: "https://cdn.jsdelivr.net/npm/tone@{version}/build/Tone.min.js",
    defaultVersion: "14.7.77",
  },
  howler: {
    name: "howler",
    cdnUrl: "https://cdn.jsdelivr.net/npm/howler@{version}/dist/howler.min.js",
    defaultVersion: "2.2.4",
  },

  // 物理エンジン
  matter: {
    name: "matter-js",
    cdnUrl: "https://cdn.jsdelivr.net/npm/matter-js@{version}/build/matter.min.js",
    defaultVersion: "0.19.0",
  },

  // ユーティリティ
  lodash: {
    name: "lodash",
    cdnUrl: "https://cdn.jsdelivr.net/npm/lodash@{version}/lodash.min.js",
    defaultVersion: "4.17.21",
  },
  dayjs: {
    name: "dayjs",
    cdnUrl: "https://cdn.jsdelivr.net/npm/dayjs@{version}/dayjs.min.js",
    defaultVersion: "1.11.10",
  },

  // データビジュアライゼーション
  d3: {
    name: "d3",
    cdnUrl: "https://cdn.jsdelivr.net/npm/d3@{version}/dist/d3.min.js",
    defaultVersion: "7.8.5",
  },
  "chart.js": {
    name: "chart.js",
    cdnUrl: "https://cdn.jsdelivr.net/npm/chart.js@{version}/dist/chart.umd.min.js",
    defaultVersion: "4.4.1",
  },

  // p5.js アドオン
  "p5.sound": {
    name: "p5.sound",
    cdnUrl: "https://cdn.jsdelivr.net/npm/p5@{version}/lib/addons/p5.sound.min.js",
    defaultVersion: "1.9.0",
  },

  // 機械学習
  ml5: {
    name: "ml5",
    cdnUrl: "https://cdn.jsdelivr.net/npm/ml5@{version}/dist/ml5.min.js",
    defaultVersion: "0.12.2",
  },
  tensorflow: {
    name: "@tensorflow/tfjs",
    cdnUrl: "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@{version}/dist/tf.min.js",
    defaultVersion: "4.17.0",
  },

  // GUI
  tweakpane: {
    name: "tweakpane",
    cdnUrl: "https://cdn.jsdelivr.net/npm/tweakpane@{version}/dist/tweakpane.min.js",
    defaultVersion: "4.0.3",
  },
  "dat.gui": {
    name: "dat.gui",
    cdnUrl: "https://cdn.jsdelivr.net/npm/dat.gui@{version}/build/dat.gui.min.js",
    defaultVersion: "0.7.9",
  },

  // 数学
  mathjs: {
    name: "mathjs",
    cdnUrl: "https://cdn.jsdelivr.net/npm/mathjs@{version}/lib/browser/math.min.js",
    defaultVersion: "12.4.0",
  },

  // カラー
  chroma: {
    name: "chroma-js",
    cdnUrl: "https://cdn.jsdelivr.net/npm/chroma-js@{version}/chroma.min.js",
    defaultVersion: "2.4.2",
  },

  // 乱数・ノイズ
  simplex: {
    name: "simplex-noise",
    cdnUrl: "https://cdn.jsdelivr.net/npm/simplex-noise@{version}/dist/esm/simplex-noise.min.js",
    defaultVersion: "4.0.1",
  },
};

export function resolveLibraryUrl(name: string, version?: string): string | null {
  const info = LIBRARY_REGISTRY[name.toLowerCase()];
  if (!info) return null;

  const v = version || info.defaultVersion;
  return info.cdnUrl.replace("{version}", v);
}
