import { describe, it, expect } from "vitest";
import { escapeForInlineScript } from "../functions/api/auth/escape";

const LINE_SEP = String.fromCharCode(0x2028);
const PARA_SEP = String.fromCharCode(0x2029);

describe("escapeForInlineScript", () => {
  it("プレーンな文字列を JSON 文字列リテラルとして返す", () => {
    expect(escapeForInlineScript("hello")).toBe('"hello"');
  });

  it("</script> を破断させない（< を \\u003c にする）", () => {
    const out = escapeForInlineScript("</script>");
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<");
    expect(out).toContain("\\u003c/script>");
  });

  it("生の U+2028 / U+2029 を含まずエスケープ表記にする", () => {
    const out = escapeForInlineScript(`a${LINE_SEP}b${PARA_SEP}c`);
    expect(out).not.toContain(LINE_SEP);
    expect(out).not.toContain(PARA_SEP);
    expect(out).toContain("\\u2028");
    expect(out).toContain("\\u2029");
  });

  it("出力は JS リテラルとして評価でき元の値に戻る", () => {
    const original = `</script>${LINE_SEP}x"y'z`;
    // 二重引用符で囲まれた JSON 由来の文字列リテラルを評価して復元する。
    const restored = JSON.parse(escapeForInlineScript(original));
    expect(restored).toBe(original);
  });
});
