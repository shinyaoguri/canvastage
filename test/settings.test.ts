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
