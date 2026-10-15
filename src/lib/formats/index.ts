/** Reading and writing every supported document format. */
import type { Editor, JSONContent } from "@tiptap/react";
import DOMPurify from "dompurify";
import documentCss from "@/styles/document.css?raw";
import { DEFAULT_PAGE, fontStack, pagePixels } from "@/lib/page";
import { extensionOf, platform } from "@/lib/platform";
import type { DocFormat, PageSetup, PlutoFile } from "@/lib/types";
import { htmlToMarkdown, markdownToHtml } from "./markdown";

export interface LoadedDocument {
  /** HTML string or Tiptap JSON. */
  content: string | JSONContent;
  page?: PageSetup;
  createdAt?: number;
  warnings: string[];
}

export function formatFromPath(path: string): DocFormat | null {
  const ext = extensionOf(path);
  if (ext === "pluto" || ext === "docx" || ext === "txt") return ext;
  if (ext === "md" || ext === "markdown") return "md";
  if (ext === "html" || ext === "htm") return "html";
  return null;
}

export const LOSSY_FORMATS: DocFormat[] = ["txt", "md"];

const SANITIZE = {
  ADD_ATTR: ["data-type", "data-checked", "data-callout", "data-page-break", "data-align", "target", "colspan", "rowspan", "colwidth"],
  FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form"],
};

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ------------------------------------------------------------------ .pluto

export function serializePluto(json: JSONContent, page: PageSetup, title: string, words: number, createdAt: number): PlutoFile {
  return {
    format: "pluto",
    version: 1,
    app: "PlutoDocs",
    meta: { title, createdAt, modifiedAt: Date.now(), words },
    page,
    content: json,
  };
}

export function parsePluto(text: string): LoadedDocument {
  const data = JSON.parse(text) as Partial<PlutoFile>;
  if (data.format !== "pluto" || !data.content) throw new Error("This is not a valid PlutoDocs document");
  return {
    content: data.content,
    page: { ...DEFAULT_PAGE, ...data.page },
    createdAt: data.meta?.createdAt,
    warnings: [],
  };
}

// ------------------------------------------------------------------ .html

export function standaloneHtml(bodyHtml: string, title: string, page: PageSetup, accentRgb: string): string {
  const px = pagePixels(page);
  const pageMeta = escapeHtml(JSON.stringify(page));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="PlutoDocs">
<meta name="pluto-page" content="${pageMeta}">
<title>${escapeHtml(title)}</title>
<style>
:root { --pd-ink: #1f2026; --pd-paper: #fff; --pd-accent-rgb: ${accentRgb}; --font-mono: "Cascadia Mono", Consolas, monospace; }
html { background: #eceef4; }
body { margin: 0; padding: 40px 16px; }
.page { box-sizing: border-box; max-width: ${px.width}px; margin: 0 auto; background: var(--pd-paper); padding: ${px.top}px ${px.right}px ${px.bottom}px ${px.left}px; box-shadow: 0 2px 6px rgba(0,0,0,.06), 0 18px 48px -18px rgba(25,30,60,.32); }
@media (max-width: 700px) { body { padding: 0; } .page { padding: 24px 16px; box-shadow: none; } }
@media print { html { background: none; } body { padding: 0; } .page { max-width: none; padding: 0; box-shadow: none; } }
${documentCss}
</style>
</head>
<body>
<article class="pluto-doc page" style="--doc-font: ${fontStack(page.fontFamily).replace(/"/g, "'")}; --doc-size: ${page.fontSize}pt">
${bodyHtml}
</article>
</body>
</html>
`;
}

export function parseHtml(text: string): LoadedDocument {
  const dom = new DOMParser().parseFromString(text, "text/html");
  let page: PageSetup | undefined;
  const meta = dom.querySelector('meta[name="pluto-page"]')?.getAttribute("content");
  if (meta) {
    try {
      page = { ...DEFAULT_PAGE, ...(JSON.parse(meta) as Partial<PageSetup>) };
    } catch {
      /* ignore malformed metadata */
    }
  }
  const root = dom.querySelector("article.pluto-doc") ?? dom.body;
  return { content: DOMPurify.sanitize(root.innerHTML, SANITIZE), page, warnings: [] };
}

// ------------------------------------------------------------------ .txt

export function textToHtml(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

// ------------------------------------------------------------------ .docx

async function parseDocx(buffer: ArrayBuffer): Promise<LoadedDocument> {
  const mammoth = (await import("mammoth")).default;
  const result = await mammoth.convertToHtml(
    { arrayBuffer: buffer },
    {
      styleMap: [
        "u => u",
        "strike => s",
        "p[style-name='Title'] => h1.title:fresh",
        "p[style-name='Subtitle'] => h2:fresh",
        "p[style-name='Quote'] => blockquote > p:fresh",
        "p[style-name='Intense Quote'] => blockquote > p:fresh",
        "p[style-name='Code'] => pre:separator('\\n')",
        "r[style-name='Code'] => code",
      ],
    },
  );
  const warnings = result.messages.filter((m) => m.type === "warning").length
    ? ["Some Word features (e.g. comments, text boxes) were simplified on import."]
    : [];
  return { content: DOMPurify.sanitize(result.value, SANITIZE), warnings };
}

// ------------------------------------------------------------------ dispatch

export async function loadDocument(path: string, format: DocFormat): Promise<LoadedDocument> {
  switch (format) {
    case "pluto":
      return parsePluto(await platform.readText(path));
    case "docx":
      return parseDocx(await platform.readBinary(path));
    case "md":
      return { content: markdownToHtml(await platform.readText(path)), warnings: [] };
    case "html":
      return parseHtml(await platform.readText(path));
    case "txt":
      return { content: textToHtml(await platform.readText(path)), warnings: [] };
  }
}

/** Serializes the editor to `format` and writes it to `path`. */
export async function writeDocument(
  editor: Editor,
  path: string,
  format: DocFormat,
  opts: { title: string; page: PageSetup; createdAt: number; accentRgb: string },
): Promise<void> {
  switch (format) {
    case "pluto": {
      const words = editor.storage.characterCount.words() as number;
      const file = serializePluto(editor.getJSON(), opts.page, opts.title, words, opts.createdAt);
      return platform.writeText(path, JSON.stringify(file));
    }
    case "docx": {
      const { jsonToDocx } = await import("./docx-export");
      return platform.writeBinary(path, await jsonToDocx(editor.getJSON(), opts.page, opts.title));
    }
    case "md":
      return platform.writeText(path, htmlToMarkdown(editor.getHTML()));
    case "html":
      return platform.writeText(path, standaloneHtml(editor.getHTML(), opts.title, opts.page, opts.accentRgb));
    case "txt":
      return platform.writeText(path, editor.getText({ blockSeparator: "\n\n" }).replace(/\n{3,}/g, "\n\n") + "\n");
  }
}
