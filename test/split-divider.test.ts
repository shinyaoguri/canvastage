import { describe, it, expect } from "vitest";
import {
  clampSplitRatio,
  isSplitToggleShortcut,
  SPLIT_RATIO_DEFAULT,
} from "../src/split-divider";

describe("clampSplitRatio", () => {
  it("範囲内はそのまま", () => {
    expect(clampSplitRatio(0.35)).toBe(0.35);
  });

  it("0.2〜0.8 に収める", () => {
    expect(clampSplitRatio(0)).toBe(0.2);
    expect(clampSplitRatio(1)).toBe(0.8);
  });

  it("数でない値は既定の半分に戻す", () => {
    expect(clampSplitRatio(Number.NaN)).toBe(SPLIT_RATIO_DEFAULT);
    expect(clampSplitRatio(Number.POSITIVE_INFINITY)).toBe(SPLIT_RATIO_DEFAULT);
  });
});

// KeyboardEvent は node 環境に無いので、判定に使うプロパティだけを持つ形で渡す。
const key = (init: Partial<KeyboardEvent>) =>
  ({
    metaKey: false,
    ctrlKey: false,
    isComposing: false,
    keyCode: 0,
    key: "",
    code: "",
    ...init,
  }) as KeyboardEvent;

describe("isSplitToggleShortcut", () => {
  it("⌘ + \\ と Ctrl + \\ で切り替える", () => {
    expect(isSplitToggleShortcut(key({ metaKey: true, key: "\\" }))).toBe(true);
    expect(isSplitToggleShortcut(key({ ctrlKey: true, key: "\\" }))).toBe(true);
  });

  it("JIS 配列の ¥ キーでも切り替える", () => {
    expect(isSplitToggleShortcut(key({ metaKey: true, key: "¥" }))).toBe(true);
    expect(
      isSplitToggleShortcut(key({ metaKey: true, key: "", code: "IntlYen" }))
    ).toBe(true);
  });

  it("修飾キーなしの \\ はただの入力", () => {
    expect(isSplitToggleShortcut(key({ key: "\\" }))).toBe(false);
  });

  it("JIS で物理位置が Backslash の ] キー (⌘+] はブラウザの「進む」) は奪わない", () => {
    expect(
      isSplitToggleShortcut(key({ metaKey: true, key: "]", code: "Backslash" }))
    ).toBe(false);
  });

  it("IME 変換中は切り替えない", () => {
    expect(
      isSplitToggleShortcut(
        key({ metaKey: true, key: "\\", isComposing: true })
      )
    ).toBe(false);
  });
});
