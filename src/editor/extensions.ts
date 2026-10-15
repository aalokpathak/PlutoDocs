import type { Editor } from "@tiptap/core";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import FileHandler from "@tiptap/extension-file-handler";
import Highlight from "@tiptap/extension-highlight";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";
import { common, createLowlight } from "lowlight";
import { imageFileToDataUrl } from "@/lib/images";
import { Callout } from "./extensions/callout";
import { ResizableImage } from "./extensions/image";
import { ParagraphSpacing } from "./extensions/line-height";
import { PageBreak } from "./extensions/page-break";
import { Search } from "./extensions/search";

export const lowlight = createLowlight(common);

const IMAGE_MIME = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml", "image/bmp"];

async function insertImageFiles(editor: Editor, files: File[], pos?: number) {
  for (const file of files) {
    const src = await imageFileToDataUrl(file);
    const content = { type: "image", attrs: { src, alt: file.name.replace(/\.[^.]+$/, "") } };
    if (pos === undefined) editor.chain().focus().insertContent(content).run();
    else editor.chain().focus().insertContentAt(pos, content).run();
  }
}

/** Shared by table cells and headers: per-cell shading. */
const cellBackground = {
  backgroundColor: {
    default: null,
    parseHTML: (el: HTMLElement) => el.style.backgroundColor || el.getAttribute("data-background") || null,
    renderHTML: (attrs: Record<string, unknown>) =>
      attrs.backgroundColor ? { style: `background-color: ${attrs.backgroundColor as string}` } : {},
  },
};

const ShadedCell = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), ...cellBackground };
  },
});
const ShadedHeader = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), ...cellBackground };
  },
});

export function buildExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      codeBlock: false,
      undoRedo: { depth: 300 },
      dropcursor: { color: "rgb(var(--pd-accent-rgb))", width: 2 },
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: "https",
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      },
    }),
    // Line spacing is paragraph-level (ParagraphSpacing), not a text-style mark.
    TextStyleKit.configure({ lineHeight: false }),
    ParagraphSpacing,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right", "justify"] }),
    Subscript,
    Superscript,
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: true, lastColumnResizable: true, allowTableNodeSelection: true }),
    TableRow,
    ShadedHeader,
    ShadedCell,
    CodeBlockLowlight.configure({ lowlight, defaultLanguage: null, enableTabIndentation: true }),
    ResizableImage,
    Callout,
    PageBreak,
    Search,
    CharacterCount,
    Placeholder.configure({
      placeholder: ({ node }) => (node.type.name === "heading" ? "Heading" : "Start writing, or pick a template from the sidebar…"),
      showOnlyCurrent: true,
    }),
    FileHandler.configure({
      allowedMimeTypes: IMAGE_MIME,
      onDrop: (editor, files, pos) => void insertImageFiles(editor, files, pos),
      onPaste: (editor, files, htmlContent) => {
        // Pasted HTML that already carries the image (e.g. from a web page) is handled by Tiptap itself.
        if (htmlContent) return;
        void insertImageFiles(editor, files);
      },
    }),
  ];
}

export { insertImageFiles };
