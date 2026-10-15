/**
 * Tiptap JSON -> native .docx (Office Open XML) using the `docx` library.
 * Produces real Word structures: heading styles, numbered/bulleted lists,
 * tables with shading, hyperlinks, images and page setup.
 */
import type { JSONContent } from "@tiptap/react";
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageBreak,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IParagraphOptions,
  type IRunOptions,
  type ParagraphChild,
} from "docx";
import { dataUrlToBytes, loadImage, rasterizeToPng } from "@/lib/images";
import { pageInches } from "@/lib/page";
import type { PageSetup } from "@/lib/types";

const TWIP_PER_INCH = 1440;
const PX_TO_TWIP = 15;

const CALLOUT_COLORS: Record<string, { fill: string; border: string }> = {
  info: { fill: "EAF2FE", border: "3B82F6" },
  success: { fill: "E8F6EE", border: "16A34A" },
  warning: { fill: "FDF3E3", border: "D97706" },
  danger: { fill: "FCEAEA", border: "DC2626" },
  note: { fill: "F1EBFD", border: "7C3AED" },
};

const HEADINGS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
];

const ALIGN: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

/** Normalizes CSS colours (#rgb, #rrggbb, rgb()) to the RRGGBB form Word uses. */
export function toHex(color: unknown): string | undefined {
  if (typeof color !== "string") return undefined;
  const c = color.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(c);
  if (m) return m[1].split("").map((ch) => ch + ch).join("").toUpperCase();
  m = /^#([0-9a-f]{6})/i.exec(c);
  if (m) return m[1].toUpperCase();
  m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(c);
  if (m) return [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("").toUpperCase();
  return undefined;
}

/** CSS font size (pt/px) -> half-points. */
function toHalfPoints(size: unknown): number | undefined {
  if (typeof size !== "string") return undefined;
  const m = /^([\d.]+)\s*(pt|px)?$/.exec(size.trim());
  if (!m) return undefined;
  const pt = m[2] === "px" ? Number(m[1]) * 0.75 : Number(m[1]);
  return Math.round(pt * 2);
}

interface Ctx {
  /** Nesting depth of bullet/numbered lists. */
  level: number;
  quote: boolean;
  callout?: string;
  /** Inside a table cell: skip paragraph spacing tweaks that look odd there. */
  cell: boolean;
  contentWidthPx: number;
}

interface Builder {
  listInstance: number;
}

type Block = Paragraph | Table;

function runOptions(node: JSONContent): IRunOptions {
  const opts: Record<string, unknown> = { text: node.text ?? "" };
  for (const mark of node.marks ?? []) {
    const a = mark.attrs ?? {};
    switch (mark.type) {
      case "bold":
        opts.bold = true;
        break;
      case "italic":
        opts.italics = true;
        break;
      case "underline":
        opts.underline = {};
        break;
      case "strike":
        opts.strike = true;
        break;
      case "subscript":
        opts.subScript = true;
        break;
      case "superscript":
        opts.superScript = true;
        break;
      case "code":
        opts.font = "Consolas";
        opts.shading = { type: ShadingType.CLEAR, fill: "EEEEF2", color: "auto" };
        break;
      case "highlight":
        opts.shading = { type: ShadingType.CLEAR, fill: toHex(a.color) ?? "FDE68A", color: "auto" };
        break;
      case "textStyle": {
        const color = toHex(a.color);
        if (color) opts.color = color;
        const bg = toHex(a.backgroundColor);
        if (bg) opts.shading = { type: ShadingType.CLEAR, fill: bg, color: "auto" };
        if (typeof a.fontFamily === "string" && a.fontFamily) {
          opts.font = a.fontFamily.split(",")[0].replace(/["']/g, "").trim();
        }
        const size = toHalfPoints(a.fontSize);
        if (size) opts.size = size;
        break;
      }
    }
  }
  return opts as IRunOptions;
}

function inlineRuns(content: JSONContent[] | undefined, extra: Partial<IRunOptions> = {}): ParagraphChild[] {
  const out: ParagraphChild[] = [];
  for (const node of content ?? []) {
    if (node.type === "hardBreak") {
      out.push(new TextRun({ break: 1 }));
      continue;
    }
    if (node.type !== "text") continue;
    const link = node.marks?.find((m) => m.type === "link")?.attrs?.href as string | undefined;
    if (link) {
      out.push(new ExternalHyperlink({ link, children: [new TextRun({ ...runOptions(node), ...extra, style: "Hyperlink" })] }));
    } else {
      out.push(new TextRun({ ...runOptions(node), ...extra }));
    }
  }
  return out;
}

/** Paragraph decorations implied by the surrounding block (quote, callout). */
function contextual(ctx: Ctx): Partial<IParagraphOptions> {
  if (ctx.callout) {
    const c = CALLOUT_COLORS[ctx.callout] ?? CALLOUT_COLORS.info;
    const side = { style: BorderStyle.SINGLE, size: 4, color: c.border, space: 6 };
    return {
      shading: { type: ShadingType.CLEAR, fill: c.fill, color: "auto" },
      border: { top: side, bottom: side, right: side, left: { style: BorderStyle.SINGLE, size: 24, color: c.border, space: 8 } },
      indent: { left: 200, right: 120 },
    };
  }
  if (ctx.quote) {
    return {
      border: { left: { style: BorderStyle.SINGLE, size: 18, color: "A5A8F0", space: 10 } },
      indent: { left: 360 },
    };
  }
  return {};
}

async function imageParagraph(node: JSONContent, ctx: Ctx): Promise<Paragraph> {
  const src = String(node.attrs?.src ?? "");
  const align = ALIGN[String(node.attrs?.align ?? "center")] ?? AlignmentType.CENTER;
  try {
    let type: "png" | "jpg" | "gif" | "bmp" = "png";
    let bytes: Uint8Array | null = null;
    let natural = { width: 0, height: 0 };
    const parsed = src.startsWith("data:") ? dataUrlToBytes(src) : null;
    const native = parsed && /image\/(png|jpe?g|gif|bmp)/.exec(parsed.mime);
    if (parsed && native) {
      bytes = parsed.bytes;
      type = native[1] === "jpeg" || native[1] === "jpg" ? "jpg" : (native[1] as "png" | "gif" | "bmp");
      const img = await loadImage(src);
      natural = { width: img.naturalWidth, height: img.naturalHeight };
    } else {
      // SVG, WebP or remote images: rasterize to PNG.
      const png = await rasterizeToPng(src);
      if (png) {
        bytes = png.bytes;
        natural = { width: png.width, height: png.height };
      }
    }
    if (!bytes || !natural.width) throw new Error("unsupported image");
    const width = Math.min(Number(node.attrs?.width) || natural.width, ctx.contentWidthPx);
    const height = Math.round((width / natural.width) * natural.height);
    return new Paragraph({
      alignment: align,
      children: [new ImageRun({ type, data: bytes, transformation: { width, height }, altText: { name: "image", title: String(node.attrs?.alt ?? ""), description: String(node.attrs?.alt ?? "") } })],
    });
  } catch {
    // Unreachable remote image: keep a link so nothing is silently lost.
    return new Paragraph({
      alignment: align,
      children: [new ExternalHyperlink({ link: src, children: [new TextRun({ text: `[Image: ${node.attrs?.alt || src}]`, style: "Hyperlink" })] })],
    });
  }
}

async function tableBlock(node: JSONContent, ctx: Ctx, b: Builder): Promise<Table> {
  const rows = node.content ?? [];
  const firstRow = rows[0]?.content ?? [];
  const colCount = Math.max(1, firstRow.reduce((n, cell) => n + (Number(cell.attrs?.colspan) || 1), 0));

  // Column widths from Tiptap's resizable columns when known, else equal shares.
  const widthsPx: (number | null)[] = [];
  for (const cell of firstRow) {
    const span = Number(cell.attrs?.colspan) || 1;
    const cw = cell.attrs?.colwidth as number[] | null | undefined;
    for (let i = 0; i < span; i++) widthsPx.push(cw?.[i] ?? null);
  }
  const known = widthsPx.reduce<number>((s, w) => s + (w ?? 0), 0);
  const unknownCount = widthsPx.filter((w) => w == null).length;
  const rest = Math.max(ctx.contentWidthPx - known, unknownCount * 40);
  let cols = widthsPx.map((w) => w ?? rest / Math.max(unknownCount, 1));
  const total = cols.reduce((s, w) => s + w, 0);
  if (total > ctx.contentWidthPx) cols = cols.map((w) => (w / total) * ctx.contentWidthPx);
  const colTwips = cols.map((w) => Math.round(w * PX_TO_TWIP));

  const tableRows: TableRow[] = [];
  for (const row of rows) {
    const cells: TableCell[] = [];
    let colIndex = 0;
    const isHeaderRow = (row.content ?? []).every((c) => c.type === "tableHeader");
    for (const cell of row.content ?? []) {
      const span = Number(cell.attrs?.colspan) || 1;
      const widthTwips = colTwips.slice(colIndex, colIndex + span).reduce((s, w) => s + w, 0) || colTwips[0];
      colIndex += span;
      const header = cell.type === "tableHeader";
      const fill = toHex(cell.attrs?.backgroundColor) ?? (header ? "EEF0FD" : undefined);
      const children = await blocks(cell.content ?? [], { ...ctx, cell: true, contentWidthPx: widthTwips / PX_TO_TWIP - 16 }, b, header);
      cells.push(
        new TableCell({
          children: children.length ? children : [new Paragraph("")],
          columnSpan: span > 1 ? span : undefined,
          rowSpan: Number(cell.attrs?.rowspan) > 1 ? Number(cell.attrs?.rowspan) : undefined,
          width: { size: widthTwips, type: WidthType.DXA },
          shading: fill ? { type: ShadingType.CLEAR, fill, color: "auto" } : undefined,
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
        }),
      );
    }
    // Only emit the flag when true: docx writes <w:tblHeader> even for false.
    tableRows.push(new TableRow({ children: cells, tableHeader: isHeaderRow || undefined }));
  }
  const border = { style: BorderStyle.SINGLE, size: 4, color: "BFC2CC" };
  return new Table({
    rows: tableRows,
    columnWidths: colTwips.length === colCount ? colTwips : undefined,
    width: { size: colTwips.reduce((s, w) => s + w, 0), type: WidthType.DXA },
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
  });
}

async function listItems(node: JSONContent, ctx: Ctx, b: Builder, ordered: boolean): Promise<Block[]> {
  const out: Block[] = [];
  const instance = ++b.listInstance;
  for (const item of node.content ?? []) {
    let first = true;
    for (const child of item.content ?? []) {
      if (child.type === "bulletList" || child.type === "orderedList" || child.type === "taskList") {
        out.push(...(await blocks([child], { ...ctx, level: ctx.level + 1 }, b)));
        continue;
      }
      if (child.type === "paragraph" && first) {
        out.push(
          new Paragraph({
            ...contextual(ctx),
            children: inlineRuns(child.content),
            alignment: ALIGN[String(child.attrs?.textAlign)] ?? undefined,
            numbering: { reference: ordered ? "pd-numbers" : "pd-bullets", level: Math.min(ctx.level, 8), instance },
          }),
        );
        first = false;
        continue;
      }
      // Continuation paragraphs align with the list text.
      const more = await blocks([child], ctx, b);
      for (const p of more) out.push(p);
    }
  }
  return out;
}

async function blocks(nodes: JSONContent[], ctx: Ctx, b: Builder, boldRuns = false): Promise<Block[]> {
  const out: Block[] = [];
  for (const node of nodes) {
    const align = ALIGN[String(node.attrs?.textAlign)] ?? undefined;
    const lineHeight = parseFloat(String(node.attrs?.lineHeight ?? ""));
    const spacing = Number.isFinite(lineHeight) ? { line: Math.round(lineHeight * 240) } : undefined;
    switch (node.type) {
      case "paragraph":
        out.push(
          new Paragraph({
            ...contextual(ctx),
            alignment: align,
            spacing,
            children: inlineRuns(node.content, boldRuns ? { bold: true } : ctx.quote && !ctx.callout ? { italics: true } : {}),
            indent: ctx.level > 0 && !ctx.callout ? { left: 720 * ctx.level } : contextual(ctx).indent,
          }),
        );
        break;
      case "heading": {
        const level = Math.min(Math.max(Number(node.attrs?.level) || 1, 1), 6);
        out.push(new Paragraph({ ...contextual(ctx), heading: HEADINGS[level - 1], alignment: align, spacing, children: inlineRuns(node.content) }));
        break;
      }
      case "bulletList":
        out.push(...(await listItems(node, ctx, b, false)));
        break;
      case "orderedList":
        out.push(...(await listItems(node, ctx, b, true)));
        break;
      case "taskList":
        for (const item of node.content ?? []) {
          const checked = !!item.attrs?.checked;
          for (const [i, child] of (item.content ?? []).entries()) {
            if (child.type === "paragraph") {
              const box = new TextRun({ text: i === 0 ? (checked ? "☑  " : "☐  ") : "     ", font: "Segoe UI Symbol" });
              out.push(
                new Paragraph({
                  ...contextual(ctx),
                  indent: { left: 360 + 720 * ctx.level, hanging: 360 },
                  children: [box, ...inlineRuns(child.content, checked ? { strike: true, color: "8A8C96" } : {})],
                }),
              );
            } else {
              out.push(...(await blocks([child], { ...ctx, level: ctx.level + 1 }, b)));
            }
          }
        }
        break;
      case "blockquote":
        out.push(...(await blocks(node.content ?? [], { ...ctx, quote: true }, b)));
        break;
      case "callout":
        out.push(...(await blocks(node.content ?? [], { ...ctx, callout: String(node.attrs?.type ?? "info") }, b)));
        break;
      case "codeBlock": {
        const text = (node.content ?? []).map((n) => n.text ?? "").join("");
        const lines = text.split("\n");
        lines.forEach((line, i) => {
          out.push(
            new Paragraph({
              shading: { type: ShadingType.CLEAR, fill: "F3F4F8", color: "auto" },
              spacing: { before: i === 0 ? 120 : 0, after: i === lines.length - 1 ? 120 : 0, line: 260 },
              indent: { left: 120, right: 120 },
              children: [new TextRun({ text: line || " ", font: "Consolas", size: 19 })],
            }),
          );
        });
        break;
      }
      case "horizontalRule":
        out.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "C9CBD4", space: 1 } }, children: [] }));
        break;
      case "pageBreak":
        out.push(new Paragraph({ children: [new PageBreak()] }));
        break;
      case "image":
        out.push(await imageParagraph(node, ctx));
        break;
      case "table":
        out.push(await tableBlock(node, ctx, b));
        // Word merges adjacent tables; keep them apart.
        out.push(new Paragraph(""));
        break;
      default:
        if (node.content) out.push(...(await blocks(node.content, ctx, b)));
    }
  }
  return out;
}

function listLevels(ordered: boolean) {
  const bullets = ["•", "◦", "▪"];
  const formats = [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN];
  return Array.from({ length: 9 }, (_, level) => ({
    level,
    format: ordered ? formats[level % 3] : LevelFormat.BULLET,
    text: ordered ? `%${level + 1}.` : bullets[level % 3],
    alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
  }));
}

export async function jsonToDocx(json: JSONContent, page: PageSetup, title: string): Promise<Uint8Array> {
  const inches = pageInches(page);
  const contentWidthPx = (inches.width - inches.left - inches.right) * 96;
  const builder: Builder = { listInstance: 0 };
  const children = await blocks(json.content ?? [], { level: 0, quote: false, cell: false, contentWidthPx }, builder);
  const base = page.fontSize * 2;
  const heading = (scale: number, color = "2B2D52") => ({
    run: { size: Math.round(base * scale), bold: true, color, font: page.fontFamily },
    paragraph: { spacing: { before: 280, after: 100 }, keepNext: true },
  });
  const twip = (n: number) => Math.round(n * TWIP_PER_INCH);

  const doc = new Document({
    creator: "PlutoDocs",
    title,
    description: "Created with PlutoDocs",
    styles: {
      default: {
        document: {
          run: { font: page.fontFamily, size: base },
          paragraph: { spacing: { after: 120, line: 300 } },
        },
        heading1: heading(2, "33367A"),
        heading2: heading(1.55, "33367A"),
        heading3: heading(1.3),
        heading4: heading(1.12),
        heading5: heading(1),
        heading6: heading(0.9, "5A5C68"),
        hyperlink: { run: { color: "4F46E5", underline: {} } },
      },
    },
    numbering: {
      config: [
        { reference: "pd-bullets", levels: listLevels(false) },
        { reference: "pd-numbers", levels: listLevels(true) },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            // docx expects portrait dimensions and swaps them for landscape itself.
            size: {
              width: twip(Math.min(inches.width, inches.height)),
              height: twip(Math.max(inches.width, inches.height)),
              orientation: page.orientation === "landscape" ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
            },
            margin: { top: twip(inches.top), right: twip(inches.right), bottom: twip(inches.bottom), left: twip(inches.left) },
          },
        },
        children: children.length ? children : [new Paragraph("")],
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  return new Uint8Array(await blob.arrayBuffer());
}
