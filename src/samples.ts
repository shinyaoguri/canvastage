import { Files } from "./preview";

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

const DEFAULT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>sketch</title>
  <script src="https://cdn.jsdelivr.net/npm/p5@1/lib/p5.min.js"></script>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <script src="sketch.js"></script>
</body>
</html>`;

const DEFAULT_CSS = `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #000;
}

canvas {
  display: block;
}`;

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
      const sketchCode = sampleSketches[sketchPath];

      const category = categories.get(categoryId);
      if (category && sketchCode) {
        category.samples.push({
          id: sampleId,
          name: meta.name,
          description: meta.description,
          files: {
            html: DEFAULT_HTML,
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
