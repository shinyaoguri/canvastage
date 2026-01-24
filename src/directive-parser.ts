export interface LibraryDirective {
  name: string;
  version?: string;
  url?: string; // 直接URL指定の場合
}

/**
 * コードから @use ディレクティブを抽出する
 *
 * 対応形式:
 * - // @use three              ← レジストリから解決
 * - // @use gsap@3.12.0        ← バージョン指定
 * - // @use https://example.com/lib.js  ← 直接URL
 */
export function parseDirectives(code: string): LibraryDirective[] {
  const directives: LibraryDirective[] = [];
  const regex = /\/\/\s*@use\s+(.+)/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(code)) !== null) {
    const value = match[1].trim();

    if (value.startsWith("http://") || value.startsWith("https://")) {
      // 直接URL
      directives.push({ name: value, url: value });
    } else if (value.includes("@")) {
      // バージョン指定 (例: gsap@3.12.0)
      const [name, version] = value.split("@");
      directives.push({ name, version });
    } else {
      // ライブラリ名のみ
      directives.push({ name: value });
    }
  }

  return directives;
}
