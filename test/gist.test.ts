import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parseGistId,
  resolveProjectName,
  resolveTitleFileName,
  isOwnGist,
  fetchGist,
  GistError,
} from "../src/gist";
import { DEFAULT_HTML, DEFAULT_CSS } from "../src/defaults";

const HEX = "a".repeat(32);

// 実装は headers を optional chain で触る（偽 Response に headers が無くても
// 落ちないこと自体が仕様）。レート制限の判定だけは headers 付きの応答が要る。
function jsonResponse(
  status: number,
  body: unknown,
  headers?: Record<string, string>
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    ...(headers
      ? { headers: { get: (name: string) => headers[name] ?? null } }
      : {}),
  } as unknown as Response;
}

function mockFetchOnce(res: Response | (() => never)) {
  const fn = vi.fn(async () => {
    if (typeof res === "function") return res();
    return res;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseGistId", () => {
  it("gist URL（user/id 付き）から id を抜き出す", () => {
    expect(parseGistId(`https://gist.github.com/someone/${HEX}`)).toBe(HEX);
  });
  it("生の id をそのまま受理する", () => {
    expect(parseGistId(HEX)).toBe(HEX);
  });
  it("16進20文字未満は拒否する", () => {
    expect(parseGistId("abc123")).toBeNull();
  });
  it("空文字は null", () => {
    expect(parseGistId("   ")).toBeNull();
  });
});

describe("resolveProjectName", () => {
  it("_<name>.md タイトルファイルを最優先で使う", () => {
    expect(resolveProjectName("desc", ["sketch.js", "_My Sketch.md"])).toBe(
      "My Sketch"
    );
  });
  it("タイトルファイルが無ければ description の接尾辞を剥がす", () => {
    expect(
      resolveProjectName("Cool Thing — canvastage sketch", ["index.html"])
    ).toBe("Cool Thing");
  });
  it("どちらも無ければ既定名", () => {
    expect(resolveProjectName(undefined, ["index.html"])).toBe(
      "imported-sketch"
    );
  });
  it("ベース名が空のタイトルファイル（_.md）は description に落ちず既定名", () => {
    expect(resolveProjectName("Cool Thing — canvastage sketch", ["_.md"])).toBe(
      "imported"
    );
  });
});

describe("resolveTitleFileName", () => {
  it("実在するタイトルファイルのベース名を返す", () => {
    expect(resolveTitleFileName(["sketch.js", "_My Sketch.md"])).toBe(
      "My Sketch"
    );
  });
  it("タイトルファイルが無ければ null", () => {
    expect(resolveTitleFileName(["index.html", "README.md"])).toBeNull();
  });
  // "_.md" は titleFileName() で復元できない（sanitizeName("") が untitled になる）。
  // 削除対象として渡すと、存在しないファイルの削除を試みることになるので null。
  it("ベース名が空（_.md）なら null", () => {
    expect(resolveTitleFileName(["_.md"])).toBeNull();
  });
});

describe("isOwnGist", () => {
  it("login が一致すれば自分の Gist", () => {
    expect(isOwnGist("octocat", "octocat")).toBe(true);
  });
  it("大文字小文字は区別しない", () => {
    expect(isOwnGist("OctoCat", "octocat")).toBe(true);
  });
  it("別人なら false", () => {
    expect(isOwnGist("someone", "octocat")).toBe(false);
  });
  // 判定不能なケースはすべて「継続しない」側に倒す。
  it("匿名 Gist（owner 無し）は false", () => {
    expect(isOwnGist(null, "octocat")).toBe(false);
  });
  it("自分の login が不明なら false", () => {
    expect(isOwnGist("octocat", null)).toBe(false);
  });
});

describe("fetchGist", () => {
  // 404 を "api" に丸めると、消えた Gist に対して自動更新が永久にリトライする。
  it("404 は GistError(notfound) を投げる", async () => {
    mockFetchOnce(jsonResponse(404, {}));
    await expect(fetchGist(HEX)).rejects.toMatchObject({
      name: "GistError",
      code: "notfound",
    });
  });

  it("残枠 0 の 403 はレート制限として扱う", async () => {
    mockFetchOnce(jsonResponse(403, {}, { "x-ratelimit-remaining": "0" }));
    await expect(fetchGist(HEX)).rejects.toMatchObject({ code: "ratelimit" });
  });

  it("残枠のある 403 は forbidden", async () => {
    mockFetchOnce(jsonResponse(403, {}, { "x-ratelimit-remaining": "42" }));
    await expect(fetchGist(HEX)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("429 はレート制限", async () => {
    mockFetchOnce(jsonResponse(429, {}));
    await expect(fetchGist(HEX)).rejects.toMatchObject({ code: "ratelimit" });
  });

  it("canvastage 形式でない Gist は弾く", async () => {
    mockFetchOnce(
      jsonResponse(200, {
        description: "",
        files: { "notes.txt": { filename: "notes.txt", content: "hi" } },
      })
    );
    await expect(fetchGist(HEX)).rejects.toBeInstanceOf(GistError);
  });

  it("truncated なファイルを含むと弾く", async () => {
    mockFetchOnce(
      jsonResponse(200, {
        files: {
          "sketch.js": {
            filename: "sketch.js",
            content: "x",
            truncated: true,
          },
        },
      })
    );
    await expect(fetchGist(HEX)).rejects.toBeInstanceOf(GistError);
  });

  it("3ファイル + タイトルファイルを正しく取り込む", async () => {
    mockFetchOnce(
      jsonResponse(200, {
        description: "ignored",
        files: {
          "_Hello.md": { filename: "_Hello.md", content: "# Hello" },
          "index.html": { filename: "index.html", content: "<h1>hi</h1>" },
          "style.css": { filename: "style.css", content: "body{}" },
          "sketch.js": { filename: "sketch.js", content: "console.log(1)" },
        },
      })
    );
    const result = await fetchGist(HEX);
    expect(result.projectName).toBe("Hello");
    expect(result.files.html).toBe("<h1>hi</h1>");
    expect(result.files.css).toBe("body{}");
    expect(result.files.js).toBe("console.log(1)");
  });

  it("html/css が欠けていれば既定値で補う", async () => {
    mockFetchOnce(
      jsonResponse(200, {
        files: {
          "sketch.js": { filename: "sketch.js", content: "noop()" },
        },
      })
    );
    const result = await fetchGist(HEX);
    expect(result.files.html).toBe(DEFAULT_HTML);
    expect(result.files.css).toBe(DEFAULT_CSS);
    expect(result.files.js).toBe("noop()");
  });

  it("想定外の JSON 形（files 欠落）は GistError(api)", async () => {
    mockFetchOnce(jsonResponse(200, { description: "x" }));
    await expect(fetchGist(HEX)).rejects.toMatchObject({ code: "api" });
  });

  it("owner / タイトルファイル名 / 更新時刻を返す", async () => {
    mockFetchOnce(
      jsonResponse(200, {
        owner: { login: "octocat" },
        html_url: "https://gist.github.com/octocat/abc",
        updated_at: "2026-08-10T00:00:00Z",
        files: {
          "_Hello.md": { filename: "_Hello.md", content: "# Hello" },
          "sketch.js": { filename: "sketch.js", content: "noop()" },
        },
      })
    );
    const result = await fetchGist(HEX);
    expect(result.gistId).toBe(HEX);
    expect(result.ownerLogin).toBe("octocat");
    expect(result.titleName).toBe("Hello");
    expect(result.htmlUrl).toBe("https://gist.github.com/octocat/abc");
    expect(result.updatedAt).toBe("2026-08-10T00:00:00Z");
  });

  it("owner が無い（匿名 Gist）なら ownerLogin は null", async () => {
    mockFetchOnce(
      jsonResponse(200, {
        files: { "sketch.js": { filename: "sketch.js", content: "noop()" } },
      })
    );
    const result = await fetchGist(HEX);
    expect(result.ownerLogin).toBeNull();
    expect(result.titleName).toBeNull();
  });

  it("トークンを渡すと Authorization ヘッダを付ける", async () => {
    const fn = mockFetchOnce(
      jsonResponse(200, {
        files: { "sketch.js": { filename: "sketch.js", content: "noop()" } },
      })
    );
    await fetchGist(HEX, "tok_123");
    const [, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok_123");
  });

  it("トークン無しでは Authorization ヘッダを付けない", async () => {
    const fn = mockFetchOnce(
      jsonResponse(200, {
        files: { "sketch.js": { filename: "sketch.js", content: "noop()" } },
      })
    );
    await fetchGist(HEX);
    const [, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });
});
