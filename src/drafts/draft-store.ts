import { createStores } from "../idb-store";
import {
  DraftRecordSchema,
  SessionRecordSchema,
  type DraftRecord,
  type SessionRecord,
} from "./draft-types";

// ドラフトは既存の DB に相乗りせず専用 DB に置く。既存 DB へ objectStore を
// 足すとバージョンを上げる必要があり、設定やトークンの保存に影響が及ぶため
// （idb-store.ts の注意書きを参照）。
const stores = createStores<{ drafts: DraftRecord; sessions: SessionRecord }>(
  "canvastage-drafts",
  ["drafts", "sessions"]
);

// IndexedDB が使えない環境（Safari のプライベートブラウジング等）では、
// 保存を試みるたびに失敗してコンソールを埋めるだけなので、一度失敗したら
// 以降は何も試みない。token-store.ts の「握り潰す」契約に揃えている。
let disabled = false;

function disable(message: string, error: unknown): void {
  if (disabled) return;
  disabled = true;
  console.warn(`${message}（この環境ではドラフトは保存されません）`, error);
}

export function isDraftStorageDisabled(): boolean {
  return disabled;
}

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

export async function loadAllDrafts(): Promise<DraftRecord[]> {
  if (disabled) return [];
  try {
    const raw = await stores.drafts.getAll();
    // 壊れたレコードや未知のスキーマ版は黙って捨てる（読めないものは無かったことにする）。
    return raw.flatMap((item) => {
      const parsed = DraftRecordSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  } catch (error) {
    disable("ドラフトの読み込みに失敗しました", error);
    return [];
  }
}

export async function saveDraft(record: DraftRecord): Promise<boolean> {
  if (disabled) return false;
  try {
    await stores.drafts.put(record.id, record);
    return true;
  } catch (error) {
    // 容量不足は「この環境では使えない」ではなく「今は入らない」なので、
    // 一番古いドラフトを捨てて一度だけやり直す。
    if (isQuotaError(error)) {
      if (await evictOldest(record.id)) {
        try {
          await stores.drafts.put(record.id, record);
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
    disable("ドラフトの保存に失敗しました", error);
    return false;
  }
}

async function evictOldest(exceptId: string): Promise<boolean> {
  const drafts = (await loadAllDrafts()).filter((d) => d.id !== exceptId);
  if (drafts.length === 0) return false;
  const oldest = drafts.reduce((a, b) => (a.updatedAt <= b.updatedAt ? a : b));
  await deleteDrafts([oldest.id]);
  return true;
}

export async function getDraft(id: string): Promise<DraftRecord | null> {
  if (disabled) return null;
  try {
    const raw = await stores.drafts.get(id);
    if (!raw) return null;
    const parsed = DraftRecordSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function deleteDrafts(ids: string[]): Promise<void> {
  if (disabled || ids.length === 0) return;
  try {
    await Promise.all(ids.map((id) => stores.drafts.delete(id)));
  } catch (error) {
    console.warn("ドラフトの削除に失敗しました", error);
  }
}

export async function loadAllSessions(): Promise<SessionRecord[]> {
  if (disabled) return [];
  try {
    const raw = await stores.sessions.getAll();
    return raw.flatMap((item) => {
      const parsed = SessionRecordSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  } catch (error) {
    disable("セッションの読み込みに失敗しました", error);
    return [];
  }
}

export async function putSession(record: SessionRecord): Promise<void> {
  if (disabled) return;
  try {
    await stores.sessions.put(record.tabId, record);
  } catch (error) {
    disable("セッションの保存に失敗しました", error);
  }
}

export async function deleteSessions(tabIds: string[]): Promise<void> {
  if (disabled || tabIds.length === 0) return;
  try {
    await Promise.all(tabIds.map((id) => stores.sessions.delete(id)));
  } catch {
    // 消せなくても次回起動の掃除が拾うので黙って進む。
  }
}

/** 設定パネルから全ドラフトを消すため（共有 PC での後始末）。 */
export async function clearAllDrafts(): Promise<void> {
  const drafts = await loadAllDrafts();
  await deleteDrafts(drafts.map((d) => d.id));
}
