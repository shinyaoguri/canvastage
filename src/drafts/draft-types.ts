import { z } from "zod";

// 作業中のスケッチ（ドラフト）の永続化スキーマ。
// settings.ts と同じく zod で定義して型は z.infer で生成する。読み込み時に
// safeParse することで、壊れたレコードを一覧から外し、フィールドを足したときも
// 既定値で吸収できる。

export const FileTypeSchema = z.enum(["html", "css", "js"]);
export type FileType = z.infer<typeof FileTypeSchema>;

export const DraftFilesSchema = z.object({
  html: z.string(),
  css: z.string(),
  js: z.string(),
});
export type DraftFiles = z.infer<typeof DraftFilesSchema>;

export const DraftRecordSchema = z.object({
  id: z.string().min(1),
  // 破壊的にスキーマを変えたときはここを上げる。将来の版で書かれたレコードは
  // safeParse に失敗し、黙って無視される（読めないものを推測して壊さない）。
  schemaVersion: z.literal(1).default(1),

  files: DraftFilesSchema,
  projectName: z.string().default(""),
  currentFile: FileTypeSchema.default("js"),

  gistId: z.string().nullable().default(null),
  // 「表示中のプロジェクト名」ではなく Gist 上に実在するタイトルファイルの
  // ベース名。リネーム時にどのファイルを消すかの特定に使う（gist.ts 参照）。
  savedProjectName: z.string().nullable().default(null),
  // 復元時に「今のトークンの持ち主」と突き合わせるために覚えておく。
  gistOwnerLogin: z.string().nullable().default(null),
  // Gist に未反映の変更があるか。落として復元すると、中身が食い違っているのに
  // 共有ボタンが「保存済み」を示してしまうので状態ごと持ち越す。
  gistDirty: z.boolean().default(false),

  openProcessingSketchId: z.number().nullable().default(null),
  openProcessingOwner: z.string().nullable().default(null),
  openProcessingDirty: z.boolean().default(false),

  createdAt: z.number(),
  /** 48 時間判定と並び順に使う最終更新時刻（epoch ms）。 */
  updatedAt: z.number(),
  /** 最後に書き込んだタブ。二重編集の検出に使う。 */
  ownerTabId: z.string(),
});
export type DraftRecord = z.infer<typeof DraftRecordSchema>;

// タブの生存を示す小さなレコード。ドラフト本体とは別ストアに置く。
// 10 秒おきに数百 KB の files ごと put するのは無駄なうえ、書き込み中の
// クラッシュでドラフト本体を壊しかねないため。
export const SessionRecordSchema = z.object({
  tabId: z.string(),
  draftId: z.string().nullable(),
  // 同じ Gist を 2 つのタブが自動更新する状態を検出するために持つ。
  gistId: z.string().nullable(),
  startedAt: z.number(),
  heartbeatAt: z.number(),
});
export type SessionRecord = z.infer<typeof SessionRecordSchema>;

/** 復元候補に出す期間。これを過ぎたドラフトは起動時に破棄する。 */
export const DRAFT_TTL_MS = 48 * 60 * 60 * 1000;

/** 保持するドラフトの上限。超えた分は古い順に捨てる。 */
export const MAX_DRAFTS = 20;

/** 1 ドラフトの保存上限。Gist 側の 1MB 制限と揃えてある。 */
export const MAX_DRAFT_BYTES = 1_000_000;

/** ハートビートの打刻間隔。 */
export const HEARTBEAT_INTERVAL_MS = 10_000;

/**
 * この時間ハートビートが途絶えたタブを「もう居ない」とみなす。
 * 間隔 10 秒に対して 90 秒と長いのは、Chrome が非表示タブの setInterval を
 * 1 分に 1 回まで絞るため。短くすると「別ウィンドウで開きっぱなしだが数分
 * 触っていないドラフト」を死んだと誤判定し、二重編集を招く。復元が 1 分半
 * 遅れるコストより、両方のタブが同じドラフトを上書きし合うコストの方が高い。
 */
export const SESSION_STALE_MS = 90_000;
