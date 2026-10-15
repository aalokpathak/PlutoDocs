import Image from "@tiptap/extension-image";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { clsx } from "clsx";
import { useRef } from "react";

export type ImageAlign = "left" | "center" | "right";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    resizableImage: {
      setImageAlign: (align: ImageAlign) => ReturnType;
      setImageWidth: (width: number | null) => ReturnType;
    };
  }
}

function ImageView({ node, updateAttributes, selected, editor }: ReactNodeViewProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const { src, alt, title, width, align } = node.attrs as {
    src: string;
    alt?: string;
    title?: string;
    width: number | null;
    align: ImageAlign;
  };

  const startResize = (e: React.PointerEvent, side: "left" | "right") => {
    e.preventDefault();
    e.stopPropagation();
    const img = imgRef.current;
    if (!img) return;
    const startX = e.clientX;
    const startWidth = img.getBoundingClientRect().width;
    // The page may be zoomed; convert screen pixels back to document pixels.
    const scale = startWidth / img.offsetWidth || 1;
    const maxWidth = (img.closest(".ProseMirror") as HTMLElement | null)?.clientWidth ?? 2000;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const delta = ((ev.clientX - startX) * (side === "right" ? 1 : -1)) / scale;
      const next = Math.round(Math.min(maxWidth, Math.max(40, startWidth / scale + delta * (align === "center" ? 2 : 1))));
      img.style.width = `${next}px`;
    };
    const onUp = () => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      updateAttributes({ width: Math.round(img.offsetWidth) });
    };
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
  };

  return (
    <NodeViewWrapper className={clsx("image-view", selected && "is-selected")} data-align={align} data-drag-handle>
      <span className="image-frame">
        <img
          ref={imgRef}
          src={src}
          alt={alt ?? ""}
          title={title ?? undefined}
          draggable={false}
          style={{ width: width ? `${width}px` : undefined }}
        />
        {selected && editor.isEditable && (
          <>
            <span className="image-handle left" onPointerDown={(e) => startResize(e, "left")} />
            <span className="image-handle right" onPointerDown={(e) => startResize(e, "right")} />
          </>
        )}
      </span>
    </NodeViewWrapper>
  );
}

/** Block image with drag-to-resize handles and left/center/right alignment. */
export const ResizableImage = Image.extend({
  name: "image",
  draggable: true,

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => {
          const w = el.getAttribute("width") || (el as HTMLElement).style.width;
          const n = w ? parseInt(w, 10) : NaN;
          return Number.isFinite(n) && n > 0 ? n : null;
        },
        renderHTML: (attrs) => (attrs.width ? { width: attrs.width } : {}),
      },
      height: { default: null, renderHTML: () => ({}) },
      align: {
        default: "center",
        parseHTML: (el) => el.getAttribute("data-align") || "center",
        renderHTML: (attrs) => ({ "data-align": attrs.align }),
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setImageAlign:
        (align) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { align }),
      setImageWidth:
        (width) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { width }),
    };
  },
}).configure({ inline: false, allowBase64: true });
