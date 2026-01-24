export interface LibraryInfo {
  name: string;
  cdnUrl: string;
  defaultVersion: string;
  globals: string[]; // window に露出する変数名
}

const LIBRARY_REGISTRY: Record<string, LibraryInfo> = {
  // 3D
  three: {
    name: "three",
    cdnUrl: "https://cdn.jsdelivr.net/npm/three@{version}/build/three.min.js",
    defaultVersion: "0.160.0",
    globals: ["THREE"],
  },

  // アニメーション
  gsap: {
    name: "gsap",
    cdnUrl: "https://cdn.jsdelivr.net/npm/gsap@{version}/dist/gsap.min.js",
    defaultVersion: "3.12.5",
    globals: ["gsap"],
  },
  anime: {
    name: "animejs",
    cdnUrl: "https://cdn.jsdelivr.net/npm/animejs@{version}/lib/anime.min.js",
    defaultVersion: "3.2.2",
    globals: ["anime"],
  },

  // オーディオ
  tone: {
    name: "tone",
    cdnUrl: "https://cdn.jsdelivr.net/npm/tone@{version}/build/Tone.min.js",
    defaultVersion: "14.7.77",
    globals: ["Tone"],
  },
  howler: {
    name: "howler",
    cdnUrl: "https://cdn.jsdelivr.net/npm/howler@{version}/dist/howler.min.js",
    defaultVersion: "2.2.4",
    globals: ["Howl", "Howler"],
  },

  // 物理エンジン
  matter: {
    name: "matter-js",
    cdnUrl: "https://cdn.jsdelivr.net/npm/matter-js@{version}/build/matter.min.js",
    defaultVersion: "0.19.0",
    globals: ["Matter"],
  },

  // ユーティリティ
  lodash: {
    name: "lodash",
    cdnUrl: "https://cdn.jsdelivr.net/npm/lodash@{version}/lodash.min.js",
    defaultVersion: "4.17.21",
    globals: ["_"],
  },
  dayjs: {
    name: "dayjs",
    cdnUrl: "https://cdn.jsdelivr.net/npm/dayjs@{version}/dayjs.min.js",
    defaultVersion: "1.11.10",
    globals: ["dayjs"],
  },

  // データビジュアライゼーション
  d3: {
    name: "d3",
    cdnUrl: "https://cdn.jsdelivr.net/npm/d3@{version}/dist/d3.min.js",
    defaultVersion: "7.8.5",
    globals: ["d3"],
  },
  "chart.js": {
    name: "chart.js",
    cdnUrl: "https://cdn.jsdelivr.net/npm/chart.js@{version}/dist/chart.umd.min.js",
    defaultVersion: "4.4.1",
    globals: ["Chart"],
  },

  // p5.js アドオン
  "p5.sound": {
    name: "p5.sound",
    cdnUrl: "https://cdn.jsdelivr.net/npm/p5@{version}/lib/addons/p5.sound.min.js",
    defaultVersion: "1.9.0",
    globals: [],
  },

  // 機械学習
  ml5: {
    name: "ml5",
    cdnUrl: "https://cdn.jsdelivr.net/npm/ml5@{version}/dist/ml5.min.js",
    defaultVersion: "0.12.2",
    globals: ["ml5"],
  },
  tensorflow: {
    name: "@tensorflow/tfjs",
    cdnUrl: "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@{version}/dist/tf.min.js",
    defaultVersion: "4.17.0",
    globals: ["tf"],
  },

  // GUI
  tweakpane: {
    name: "tweakpane",
    cdnUrl: "https://cdn.jsdelivr.net/npm/tweakpane@{version}/dist/tweakpane.min.js",
    defaultVersion: "4.0.3",
    globals: ["Tweakpane"],
  },
  "dat.gui": {
    name: "dat.gui",
    cdnUrl: "https://cdn.jsdelivr.net/npm/dat.gui@{version}/build/dat.gui.min.js",
    defaultVersion: "0.7.9",
    globals: ["dat"],
  },

  // 数学
  mathjs: {
    name: "mathjs",
    cdnUrl: "https://cdn.jsdelivr.net/npm/mathjs@{version}/lib/browser/math.min.js",
    defaultVersion: "12.4.0",
    globals: ["math"],
  },

  // カラー
  chroma: {
    name: "chroma-js",
    cdnUrl: "https://cdn.jsdelivr.net/npm/chroma-js@{version}/chroma.min.js",
    defaultVersion: "2.4.2",
    globals: ["chroma"],
  },

  // 乱数・ノイズ
  simplex: {
    name: "simplex-noise",
    cdnUrl: "https://cdn.jsdelivr.net/npm/simplex-noise@{version}/dist/esm/simplex-noise.min.js",
    defaultVersion: "4.0.1",
    globals: ["SimplexNoise"],
  },
};

export function getLibraryInfo(name: string): LibraryInfo | undefined {
  return LIBRARY_REGISTRY[name.toLowerCase()];
}

export function resolveLibraryUrl(name: string, version?: string): string | null {
  const info = getLibraryInfo(name);
  if (!info) return null;

  const v = version || info.defaultVersion;
  return info.cdnUrl.replace("{version}", v);
}

export function getAllLibraries(): LibraryInfo[] {
  return Object.values(LIBRARY_REGISTRY);
}
