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

  // 分割表示では親からの入力転送を止める。ブリッジは読み込み時にこのフラグを
  // 見るので、ブリッジ本体より前に埋め込まれていなければならない。
  it("既定では入力転送を有効にするフラグを埋め込む（重ね表示と互換）", () => {
    const out = buildHtml(files(`<html><head></head><body></body></html>`));
    expect(out).toContain("window._parentInputEnabled = true;");
  });

  it("forwardInput: false なら転送を止めるフラグをブリッジより前に埋め込む", () => {
    const out = buildHtml(files(`<html><head></head><body></body></html>`), {
      forwardInput: false,
    });
    const flagAt = out.indexOf("window._parentInputEnabled = false;");
    expect(flagAt).toBeGreaterThan(-1);
    expect(out).not.toContain("window._parentInputEnabled = true;");
    expect(flagAt).toBeLessThan(out.indexOf("window._parentInput = {"));
  });

  it("プレースホルダが無くても JS が末尾に注入される", () => {
    const out = buildHtml(files(`<html><head></head><body></body></html>`));
    expect(out).toContain("console.log('hi')");
  });
});
