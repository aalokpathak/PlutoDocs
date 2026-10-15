import { CellSelection } from "@tiptap/pm/tables";
import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { clsx } from "clsx";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ExternalLink,
  Highlighter,
  Italic,
  Link2,
  Pencil,
  Strikethrough,
  Trash2,
  Underline,
  Unlink,
} from "lucide-react";
import type { ReactNode } from "react";
import { openExternal } from "@/lib/links";
import { useApp } from "@/store/app";
import { useFormatState } from "@/components/ribbon/shared";

function BubbleButton({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={clsx(
        "flex h-7 min-w-7 items-center justify-center gap-1 rounded-md px-1.5 text-[12px] transition-colors",
        active ? "bg-accent-soft text-accent" : "text-fg hover:bg-hover",
      )}
    >
      {children}
    </button>
  );
}

const bar = "glass-strong flex items-center gap-0.5 rounded-lg p-1";

function TextBubble({ editor, scroller }: { editor: Editor; scroller: HTMLElement }) {
  const s = useFormatState(editor);
  const openDialog = useApp((st) => st.openDialog);
  const chain = () => editor.chain().focus();
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="textBubble"
      appendTo={() => document.body}
      style={{ zIndex: 40 }}
      options={{ strategy: "fixed", placement: "top", offset: 8, scrollTarget: scroller }}
      shouldShow={({ editor: e, state, from, to }) => {
        if (from === to || !e.isEditable) return false;
        if (e.isActive("image") || e.isActive("codeBlock") || e.isActive("pageBreak")) return false;
        // Cell selections are handled by the Table Design tab.
        return !(state.selection instanceof CellSelection) && !!state.doc.textBetween(from, to).trim();
      }}
    >
      <div className={bar}>
        <BubbleButton label="Bold" active={s.bold} onClick={() => chain().toggleBold().run()}>
          <Bold className="size-[15px]" strokeWidth={2.5} />
        </BubbleButton>
        <BubbleButton label="Italic" active={s.italic} onClick={() => chain().toggleItalic().run()}>
          <Italic className="size-[15px]" />
        </BubbleButton>
        <BubbleButton label="Underline" active={s.underline} onClick={() => chain().toggleUnderline().run()}>
          <Underline className="size-[15px]" />
        </BubbleButton>
        <BubbleButton label="Strikethrough" active={s.strike} onClick={() => chain().toggleStrike().run()}>
          <Strikethrough className="size-[15px]" />
        </BubbleButton>
        <BubbleButton label="Highlight" active={s.highlight} onClick={() => chain().toggleHighlight({ color: "#fde68a" }).run()}>
          <Highlighter className="size-[15px]" />
        </BubbleButton>
        <div className="mx-0.5 h-5 w-px bg-stroke-strong" />
        <BubbleButton label="Link (Ctrl+K)" active={s.link} onClick={() => openDialog({ kind: "link" })}>
          <Link2 className="size-[15px]" />
        </BubbleButton>
      </div>
    </BubbleMenu>
  );
}

function LinkBubble({ editor, scroller }: { editor: Editor; scroller: HTMLElement }) {
  const openDialog = useApp((s) => s.openDialog);
  const href = (editor.getAttributes("link").href as string | undefined) ?? "";
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="linkBubble"
      appendTo={() => document.body}
      style={{ zIndex: 40 }}
      options={{ strategy: "fixed", placement: "bottom-start", offset: 6, scrollTarget: scroller }}
      shouldShow={({ editor: e, from, to }) => from === to && e.isActive("link")}
    >
      <div className={clsx(bar, "max-w-[420px]")}>
        <button
          type="button"
          onClick={() => void openExternal(href)}
          className="min-w-0 truncate rounded-md px-2 py-1 text-left text-[12.5px] text-accent hover:bg-hover hover:underline"
          title={`Open ${href}`}
        >
          {href}
        </button>
        <div className="mx-0.5 h-5 w-px shrink-0 bg-stroke-strong" />
        <BubbleButton label="Open link" onClick={() => void openExternal(href)}>
          <ExternalLink className="size-[15px]" />
        </BubbleButton>
        <BubbleButton label="Edit link" onClick={() => openDialog({ kind: "link" })}>
          <Pencil className="size-[15px]" />
        </BubbleButton>
        <BubbleButton label="Remove link" onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}>
          <Unlink className="size-[15px]" />
        </BubbleButton>
      </div>
    </BubbleMenu>
  );
}

function ImageBubble({ editor, scroller }: { editor: Editor; scroller: HTMLElement }) {
  const attrs = editor.getAttributes("image") as { align?: string; width?: number | null };
  const chain = () => editor.chain().focus();
  const setPercent = (pct: number) => {
    const contentWidth = editor.view.dom.clientWidth;
    chain().setImageWidth(Math.round((contentWidth * pct) / 100)).run();
  };
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="imageBubble"
      appendTo={() => document.body}
      style={{ zIndex: 40 }}
      options={{ strategy: "fixed", placement: "top", offset: 10, scrollTarget: scroller }}
      shouldShow={({ editor: e }) => e.isActive("image")}
    >
      <div className={bar}>
        <BubbleButton label="Align left" active={attrs.align === "left"} onClick={() => chain().setImageAlign("left").run()}>
          <AlignLeft className="size-[15px]" />
        </BubbleButton>
        <BubbleButton label="Center" active={(attrs.align ?? "center") === "center"} onClick={() => chain().setImageAlign("center").run()}>
          <AlignCenter className="size-[15px]" />
        </BubbleButton>
        <BubbleButton label="Align right" active={attrs.align === "right"} onClick={() => chain().setImageAlign("right").run()}>
          <AlignRight className="size-[15px]" />
        </BubbleButton>
        <div className="mx-0.5 h-5 w-px bg-stroke-strong" />
        {[25, 50, 75, 100].map((p) => (
          <BubbleButton key={p} label={`${p}% width`} onClick={() => setPercent(p)}>
            {p}%
          </BubbleButton>
        ))}
        <BubbleButton label="Original size" active={!attrs.width} onClick={() => chain().setImageWidth(null).run()}>
          Auto
        </BubbleButton>
        <div className="mx-0.5 h-5 w-px bg-stroke-strong" />
        <BubbleButton label="Delete picture" onClick={() => chain().deleteSelection().run()}>
          <Trash2 className="size-[15px]" />
        </BubbleButton>
      </div>
    </BubbleMenu>
  );
}

export function BubbleMenus({ editor, scroller }: { editor: Editor; scroller: HTMLElement }) {
  return (
    <>
      <TextBubble editor={editor} scroller={scroller} />
      <LinkBubble editor={editor} scroller={scroller} />
      <ImageBubble editor={editor} scroller={scroller} />
    </>
  );
}
