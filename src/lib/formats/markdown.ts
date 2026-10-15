import DOMPurify from "dompurify";
import { marked } from "marked";
import TurndownService from "turndown";
import { strikethrough, tables } from "turndown-plugin-gfm";

// ------------------------------------------------------------------ HTML -> Markdown

const CALLOUT_TO_ALERT: Record<string, string> = {
  info: "NOTE",
  success: "TIP",
  note: "IMPORTANT",
  warning: "WARNING",
  danger: "CAUTION",
};
const ALERT_TO_CALLOUT = Object.fromEntries(Object.entries(CALLOUT_TO_ALERT).map(([k, v]) => [v, k]));

const PAGE_BREAK_MD = "\n\n<div data-page-break></div>\n\n";
const BLOCK_TAGS = new Set(["ARTICLE", "ASIDE", "BLOCKQUOTE", "DIV", "FIGURE", "H1", "H2", "H3", "H4", "H5", "H6", "HR", "LI", "OL", "P", "PRE", "SECTION", "TABLE", "TD", "TH", "TR", "UL"]);

function createTurndown() {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
    strongDelimiter: "**",
    hr: "---",
    // Empty elements bypass the rules entirely, so page breaks are handled here.
    blankReplacement: (_content, node) => {
      const el = node as HTMLElement;
      if (el.hasAttribute?.("data-page-break")) return PAGE_BREAK_MD;
      return BLOCK_TAGS.has(el.nodeName) ? "\n\n" : "";
    },
  });
  td.use([tables, strikethrough]);

  // Formatting Markdown has no syntax for stays as inline HTML.
  td.keep(["u", "sub", "sup"]);

  td.addRule("highlight", {
    filter: "mark",
    replacement: (content) => `==${content}==`,
  });

  td.addRule("taskItem", {
    filter: (node) => node.nodeName === "LI" && node.parentElement?.getAttribute("data-type") === "taskList",
    replacement: (content, node) => {
      const checked = (node as HTMLElement).getAttribute("data-checked") === "true";
      const body = content.replace(/^\n+/, "").replace(/\n+$/, "").replace(/\n/gm, "\n  ");
      return `- [${checked ? "x" : " "}] ${body}\n`;
    },
  });

  td.addRule("callout", {
    filter: (node) => node.nodeName === "DIV" && node.hasAttribute("data-callout"),
    replacement: (content, node) => {
      const type = CALLOUT_TO_ALERT[(node as HTMLElement).getAttribute("data-callout") ?? "info"] ?? "NOTE";
      const quoted = content.trim().replace(/^/gm, "> ");
      return `\n\n> [!${type}]\n${quoted}\n\n`;
    },
  });

  td.addRule("image", {
    filter: "img",
    replacement: (_content, node) => {
      const el = node as HTMLImageElement;
      const alt = (el.getAttribute("alt") ?? "").replace(/[[\]]/g, "");
      const src = el.getAttribute("src") ?? "";
      const title = el.getAttribute("title");
      return src ? `![${alt}](${src}${title ? ` "${title.replace(/"/g, "'")}"` : ""})` : "";
    },
  });

  return td;
}

let turndown: TurndownService | null = null;

/** Tiptap wraps table cell content in <p>; GFM table cells must be single-line. */
function flattenTableCells(root: HTMLElement) {
  // turndown-plugin-gfm only recognises a header row when <tbody> is the table's first child.
  root.querySelectorAll("colgroup").forEach((el) => el.remove());
  root.querySelectorAll("td, th").forEach((cell) => {
    const paragraphs = Array.from(cell.querySelectorAll(":scope > p"));
    if (!paragraphs.length) return;
    cell.innerHTML = paragraphs.map((p) => p.innerHTML).join("<br>");
  });
  // GFM tables need a header row; promote the first row when it has none.
  root.querySelectorAll("table").forEach((table) => {
    const first = table.querySelector("tr");
    if (!first || first.querySelector("th")) return;
    first.querySelectorAll("td").forEach((td) => {
      const th = document.createElement("th");
      th.innerHTML = td.innerHTML;
      td.replaceWith(th);
    });
  });
}

export function htmlToMarkdown(html: string): string {
  turndown ??= createTurndown();
  const root = document.createElement("div");
  root.innerHTML = html;
  flattenTableCells(root);
  // Code blocks: turndown reads the language from `class="language-x"`.
  return turndown.turndown(root).replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

// ------------------------------------------------------------------ Markdown -> HTML

/** Rewrites marked's GFM output into the HTML shapes Tiptap's extensions parse. */
function adaptMarkedHtml(html: string): string {
  const root = document.createElement("div");
  root.innerHTML = html;

  // Task lists: <li><input type=checkbox> text</li>  ->  Tiptap task items.
  root.querySelectorAll("ul").forEach((ul) => {
    const items = Array.from(ul.children).filter((c) => c.tagName === "LI");
    if (!items.length || !items.every((li) => li.querySelector(":scope > input[type=checkbox], :scope > p > input[type=checkbox]"))) return;
    ul.setAttribute("data-type", "taskList");
    items.forEach((li) => {
      const box = li.querySelector("input[type=checkbox]") as HTMLInputElement;
      li.setAttribute("data-type", "taskItem");
      li.setAttribute("data-checked", box.checked ? "true" : "false");
      box.remove();
    });
  });

  // GitHub alerts: > [!NOTE] ...  ->  callouts.
  root.querySelectorAll("blockquote").forEach((bq) => {
    const first = bq.querySelector(":scope > p");
    const m = first?.innerHTML.match(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(<br>)?\s*/i);
    if (!first || !m) return;
    first.innerHTML = first.innerHTML.slice(m[0].length);
    if (!first.innerHTML.trim()) first.remove();
    const div = document.createElement("div");
    div.setAttribute("data-callout", ALERT_TO_CALLOUT[m[1].toUpperCase()] ?? "info");
    div.innerHTML = bq.innerHTML.trim() || "<p></p>";
    bq.replaceWith(div);
  });

  // ==highlight== (not part of GFM).
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  while (walker.nextNode()) texts.push(walker.currentNode as Text);
  for (const t of texts) {
    if (!t.data.includes("==") || t.parentElement?.closest("code, pre")) continue;
    const span = document.createElement("span");
    span.innerHTML = t.data
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/==([^=\n]+)==/g, "<mark>$1</mark>");
    t.replaceWith(...Array.from(span.childNodes));
  }
  return root.innerHTML;
}

export function markdownToHtml(md: string): string {
  const html = marked.parse(md, { gfm: true, breaks: false, async: false }) as string;
  return DOMPurify.sanitize(adaptMarkedHtml(html), { ADD_ATTR: ["data-type", "data-checked", "data-callout", "data-page-break", "target"] });
}
