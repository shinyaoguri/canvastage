// インラインスクリプトに埋め込む文字列を安全にシリアライズする。
// JSON.stringify は `</script>` や U+2028/U+2029 をエスケープしないため、
// 外部由来の値（state, error_description, token）をそのまま埋め込むと XSS や
// スクリプト破断になりうる。`<` と行区切り文字を追加でエスケープする。
// 行区切り文字はソースに直接書かず文字コードから生成する（可読性・誤改変防止）。
const LINE_SEP = String.fromCharCode(0x2028);
const PARA_SEP = String.fromCharCode(0x2029);

export function escapeForInlineScript(value: string): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .split(LINE_SEP)
    .join("\\u2028")
    .split(PARA_SEP)
    .join("\\u2029");
}
