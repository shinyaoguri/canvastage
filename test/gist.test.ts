import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parseGistId,
  resolveProjectName,
  fetchGist,
  GistError,
} from "../src/gist";
import { DEFAULT_HTML, DEFAULT_CSS } from "../src/defaults";

const HEX = "a".repeat(32);

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
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
});

describe("fetchGist", () => {
  it("404 は GistError(api) を投げる", async () => {
    mockFetchOnce(jsonResponse(404, {}));
    await expect(fetchGist(HEX)).rejects.toMatchObject({
      name: "GistError",
      code: "api",
    });
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
});
