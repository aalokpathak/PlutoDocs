import { useEditorState, type Editor } from "@tiptap/react";
import { clsx } from "clsx";
import type { ReactNode } from "react";

export const FONT_FAMILIES = [
  "Calibri",
  "Aptos",
  "Segoe UI",
  "Arial",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Century Gothic",
  "Cambria",
  "Georgia",
  "Times New Roman",
  "Garamond",
  "Book Antiqua",
  "Palatino Linotype",
  "Consolas",
  "Courier New",
  "Comic Sans MS",
];

export const FONT_SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 60, 72];

export const LINE_HEIGHTS = ["1", "1.15", "1.5", "2", "2.5", "3"];

/** A labelled cluster of ribbon controls, separated from its neighbours. */
export function Group({ children, label, last }: { children: ReactNode; label?: string; last?: boolean }) {
  return (
    <div className={clsx("flex shrink-0 items-center gap-0.5 px-1.5", !last && "border-r border-stroke")} role="group" aria-label={label}>
      {children}
    </div>
  );
}

/** Font family name without quotes or fallbacks. */
export function primaryFont(family: string | undefined | null): string | null {
  if (!family) return null;
  return family.split(",")[0].replace(/["']/g, "").trim() || null;
}

/** Selection-derived formatting state, recomputed on every transaction. */
export function useFormatState(editor: Editor) {
  return useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const ts = e.getAttributes("textStyle");
      const para = e.isActive("heading") ? e.getAttributes("heading") : e.getAttributes("paragraph");
      let block = "paragraph";
      for (let l = 1; l <= 6; l++) if (e.isActive("heading", { level: l })) block = `h${l}`;
      if (e.isActive("codeBlock")) block = "code";
      return {
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        underline: e.isActive("underline"),
        strike: e.isActive("strike"),
        code: e.isActive("code"),
        subscript: e.isActive("subscript"),
        superscript: e.isActive("superscript"),
        link: e.isActive("link"),
        highlight: e.isActive("highlight"),
        bulletList: e.isActive("bulletList"),
        orderedList: e.isActive("orderedList"),
        taskList: e.isActive("taskList"),
        blockquote: e.isActive("blockquote"),
        callout: e.isActive("callout"),
        codeBlock: e.isActive("codeBlock"),
        table: e.isActive("table"),
        image: e.isActive("image"),
        align: (["left", "center", "right", "justify"] as const).find((a) => e.isActive({ textAlign: a })) ?? "left",
        block,
        fontFamily: primaryFont(ts.fontFamily as string | undefined),
        fontSize: (ts.fontSize as string | undefined) ?? null,
        color: (ts.color as string | undefined) ?? null,
        lineHeight: (para.lineHeight as string | undefined) ?? null,
        canIndent: e.can().sinkListItem("listItem") || e.can().sinkListItem("taskItem"),
        canOutdent: e.can().liftListItem("listItem") || e.can().liftListItem("taskItem"),
      };
    },
  });
}

export type FormatState = ReturnType<typeof useFormatState>;
