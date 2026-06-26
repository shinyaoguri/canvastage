import { escapeForInlineScript } from "./escape";

interface Env {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code) {
    return new Response("Missing code parameter", { status: 400 });
  }

  const tokenResponse = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: context.env.GITHUB_CLIENT_ID,
        client_secret: context.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    }
  );

  const tokenData = (await tokenResponse.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  // インラインスクリプトに埋め込む外部由来の値を安全にエスケープする。
  const safe = escapeForInlineScript;

  if (tokenData.error || !tokenData.access_token) {
    const errorMsg =
      tokenData.error_description || tokenData.error || "Unknown error";
    return new Response(
      `<!DOCTYPE html><html><body><script>
window.opener?.postMessage({
  type: "github-auth-error",
  error: ${safe(errorMsg)}
}, window.location.origin);
window.close();
</script></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  return new Response(
    `<!DOCTYPE html><html><body><script>
window.opener?.postMessage({
  type: "github-auth-success",
  token: ${safe(tokenData.access_token)},
  state: ${safe(state || "")}
}, window.location.origin);
window.close();
</script></body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
};
