import { describe, it, expect } from "vitest";
import { EditorSettingsSchema, DEFAULT_SETTINGS } from "../src/settings";

// 設定スキーマの既定値・後方互換。DOM 非依存の純粋ロジックなのでここで見る
// （ボタンが実際に消える/出るところは e2e/settings.spec.ts）。
describe("showOpenProcessingButton", () => {
  it("既定は false（OpenProcessing デプロイは Plus+ 限定なので隠す）", () => {
    expect(DEFAULT_SETTINGS.showOpenProcessingButton).toBe(false);
    expect(EditorSettingsSchema.parse({}).showOpenProcessingButton).toBe(false);
  });

  it("この設定より前に保存された設定を読んでも false になる（undefined にしない）", () => {
    const legacySaved = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
    delete legacySaved.showOpenProcessingButton;

    const parsed = EditorSettingsSchema.parse(legacySaved);
    expect(parsed.showOpenProcessingButton).toBe(false);
  });

  it("明示的に true を保存していればそのまま復元する", () => {
    const parsed = EditorSettingsSchema.parse({
      showOpenProcessingButton: true,
    });
    expect(parsed.showOpenProcessingButton).toBe(true);
  });
});

// 分割表示。既存ユーザーの見た目を変えないよう既定は重ね表示。
describe("splitView / splitRatio", () => {
  it("既定は重ね表示で、比率は半分", () => {
    expect(DEFAULT_SETTINGS.splitView).toBe(false);
    expect(DEFAULT_SETTINGS.splitRatio).toBe(0.5);
  });

  it("この設定より前に保存された設定を読んでも重ね表示になる", () => {
    const legacySaved = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
    delete legacySaved.splitView;
    delete legacySaved.splitRatio;

    const parsed = EditorSettingsSchema.parse(legacySaved);
    expect(parsed.splitView).toBe(false);
    expect(parsed.splitRatio).toBe(0.5);
  });

  it("比率は 0.2〜0.8 の外を受け付けない", () => {
    expect(EditorSettingsSchema.safeParse({ splitRatio: 0.1 }).success).toBe(
      false
    );
    expect(EditorSettingsSchema.safeParse({ splitRatio: 0.9 }).success).toBe(
      false
    );
    expect(EditorSettingsSchema.parse({ splitRatio: 0.2 }).splitRatio).toBe(
      0.2
    );
    expect(EditorSettingsSchema.parse({ splitRatio: 0.8 }).splitRatio).toBe(
      0.8
    );
  });
});
