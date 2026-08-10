import { describe, it, expect } from "vitest";
import {
  DraftRecordSchema,
  SessionRecordSchema,
} from "../src/drafts/draft-types";

// 保存済みレコードの読み込みは safeParse で行う。壊れたレコードを一覧から外し、
// フィールドを足したときも既定値で吸収できることをここで固定する。

const BASE = {
  id: "d1",
  files: { html: "<html></html>", css: "body{}", js: "noop()" },
  createdAt: 1_800_000_000_000,
  updatedAt: 1_800_000_000_000,
  ownerTabId: "tab-1",
};

describe("DraftRecordSchema", () => {
  it("必須フィールドだけで既定値が埋まる", () => {
    const parsed = DraftRecordSchema.parse(BASE);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.currentFile).toBe("js");
    expect(parsed.projectName).toBe("");
    expect(parsed.gistId).toBeNull();
    expect(parsed.savedProjectName).toBeNull();
    expect(parsed.gistOwnerLogin).toBeNull();
    expect(parsed.gistDirty).toBe(false);
    expect(parsed.openProcessingSketchId).toBeNull();
  });

  it("完全なレコードをそのまま通す", () => {
    const full = {
      ...BASE,
      schemaVersion: 1,
      projectName: "neon-wave-a7f",
      currentFile: "html",
      gistId: "abc",
      savedProjectName: "neon-wave-a7f",
      gistOwnerLogin: "octocat",
      gistDirty: true,
      openProcessingSketchId: 12345,
      openProcessingOwner: "octocat",
      openProcessingDirty: true,
    };
    expect(DraftRecordSchema.parse(full)).toMatchObject(full);
  });

  it("files が壊れたレコードは弾く", () => {
    const broken = { ...BASE, files: { html: "", css: "", js: 42 } };
    expect(DraftRecordSchema.safeParse(broken).success).toBe(false);
  });

  it("id が空のレコードは弾く", () => {
    expect(DraftRecordSchema.safeParse({ ...BASE, id: "" }).success).toBe(
      false
    );
  });

  // 将来の版が書いたレコードは読めないので、推測して壊すより黙って無視する。
  it("未知のスキーマ版は弾く", () => {
    const future = { ...BASE, schemaVersion: 2 };
    expect(DraftRecordSchema.safeParse(future).success).toBe(false);
  });

  it("不正なタブ名は弾く", () => {
    const bad = { ...BASE, currentFile: "python" };
    expect(DraftRecordSchema.safeParse(bad).success).toBe(false);
  });
});

describe("SessionRecordSchema", () => {
  it("最小構成を通す", () => {
    const parsed = SessionRecordSchema.parse({
      tabId: "tab-1",
      draftId: null,
      gistId: null,
      startedAt: 1,
      heartbeatAt: 2,
    });
    expect(parsed.tabId).toBe("tab-1");
    expect(parsed.draftId).toBeNull();
  });

  it("heartbeatAt が無いレコードは弾く", () => {
    const broken = { tabId: "t", draftId: null, gistId: null, startedAt: 1 };
    expect(SessionRecordSchema.safeParse(broken).success).toBe(false);
  });
});
