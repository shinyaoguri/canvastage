import { describe, it, expect } from "vitest";
import { buildHtml } from "../src/preview";

const files = (html: string) => ({
  html,
  css: "body { margin: 0; }",
  js: "console.log('hi')",
});

describe("buildHtml", () => {
  it("style.css の link を inline style に置換する", () => {
    const out = buildHtml(
      files(
        `<!DOCTYPE html><html><head><link rel="stylesheet" href="style.css"></head><body><script src="sketch.js"></script></body></html>`
      )
    );
    expect(out).not.toContain('href="style.css"');
    expect(out).toContain("body { margin: 0; }");
  });

  it("sketch.js の script を inline script に置換する", () => {
    const out = buildHtml(
      files(
        `<!DOCTYPE html><html><head></head><body><script src="sketch.js"></script></body></html>`
      )
    );
    expect(out).not.toContain('src="sketch.js"');
    expect(out).toContain("console.log('hi')");
  });

  it("コンソール/入力ブリッジを必ず注入する", () => {
    const out = buildHtml(files(`<html><head></head><body></body></html>`));
    expect(out).toContain("window.parent.postMessage");
    expect(out).toContain("_parentInput");
  });

  it("<head> が無くても CSS とブリッジが消えない", () => {
    const out = buildHtml(files(`<body><p>no head</p></body>`));
    expect(out).toContain("body { margin: 0; }");
    expect(out).toContain("_parentInput");
  });

  it("プレースホルダが無くても JS が末尾に注入される", () => {
    const out = buildHtml(files(`<html><head></head><body></body></html>`));
    expect(out).toContain("console.log('hi')");
  });
});
