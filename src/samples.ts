import { Files } from "./preview";
import { DEFAULT_HTML, DEFAULT_CSS } from "./defaults";

export interface Sample {
  id: string;
  name: string;
  description: string;
  files: Files;
}

export interface SampleCategory {
  id: string;
  name: string;
  icon: string;
  order: number;
  samples: Sample[];
}

interface CategoryMeta {
  name: string;
  icon: string;
  order: number;
}

interface SampleMeta {
  name: string;
  description: string;
}

// Vite の import.meta.glob でサンプルファイルを読み込む
const categoryMetas = import.meta.glob<CategoryMeta>(
  "./samples/*/_category.json",
  { eager: true, import: "default" }
);

const sampleMetas = import.meta.glob<SampleMeta>(
  "./samples/*/*/meta.json",
  { eager: true, import: "default" }
);

const sampleSketches = import.meta.glob<string>(
  "./samples/*/*/sketch.js",
  { eager: true, query: "?raw", import: "default" }
);

const sampleHtmls = import.meta.glob<string>(
  "./samples/*/*/index.html",
  { eager: true, query: "?raw", import: "default" }
);

// カテゴリとサンプルを構築
function buildSampleCategories(): SampleCategory[] {
  const categories = new Map<string, SampleCategory>();

  // カテゴリを初期化
  for (const [path, meta] of Object.entries(categoryMetas)) {
    // path: "./samples/basics/_category.json" -> categoryId: "basics"
    const match = path.match(/\.\/samples\/([^/]+)\/_category\.json/);
    if (match) {
      const categoryId = match[1];
      categories.set(categoryId, {
        id: categoryId,
        name: meta.name,
        icon: meta.icon,
        order: meta.order,
        samples: [],
      });
    }
  }

  // サンプルを追加
  for (const [path, meta] of Object.entries(sampleMetas)) {
    // path: "./samples/basics/hello-circle/meta.json"
    const match = path.match(/\.\/samples\/([^/]+)\/([^/]+)\/meta\.json/);
    if (match) {
      const [, categoryId, sampleId] = match;
      const sketchPath = `./samples/${categoryId}/${sampleId}/sketch.js`;
      const htmlPath = `./samples/${categoryId}/${sampleId}/index.html`;
      const sketchCode = sampleSketches[sketchPath];
      const customHtml = sampleHtmls[htmlPath];

      const category = categories.get(categoryId);
      if (category && sketchCode) {
        category.samples.push({
          id: sampleId,
          name: meta.name,
          description: meta.description,
          files: {
            html: customHtml || DEFAULT_HTML,
            css: DEFAULT_CSS,
            js: sketchCode,
          },
        });
      }
    }
  }

  // order でソートして返す
  return Array.from(categories.values()).sort((a, b) => a.order - b.order);
}

export const SAMPLE_CATEGORIES: SampleCategory[] = buildSampleCategories();

export function getRandomBasicsSample(): Files | null {
  const basics = SAMPLE_CATEGORIES.find((c) => c.id === "basics");
  if (!basics || basics.samples.length === 0) return null;
  const sample = basics.samples[Math.floor(Math.random() * basics.samples.length)];
  return { ...sample.files };
}
