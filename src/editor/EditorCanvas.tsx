import { EditorContent, type Editor } from "@tiptap/react";
import { useEffect, useState, type CSSProperties } from "react";
import { zoomStep } from "@/components/ribbon/ViewTab";
import { fontStack, pagePixels } from "@/lib/page";
import { useApp } from "@/store/app";
import { BubbleMenus } from "./BubbleMenus";

/** The centered "paper" the document is written on. */
export function EditorCanvas({ editor }: { editor: Editor }) {
  const page = useApp((s) => s.doc.page);
  const zoom = useApp((s) => s.zoom);
  const showGuides = useApp((s) => s.settings.showPageGuides);
  const spellcheck = useApp((s) => s.settings.spellcheck);
  const focusMode = useApp((s) => s.focusMode);
  const pageCount = useApp((s) => s.pageCount);
  const setPageCount = useApp((s) => s.setPageCount);
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const px = pagePixels(page);

  // Grow the paper one whole page at a time, like a word processor's print layout.
  useEffect(() => {
    const dom = editor.view.dom;
    const measure = () => {
      const total = dom.offsetHeight + px.top + px.bottom;
      // Hard page breaks start new pages in print even when the text would fit.
      const breaks = dom.querySelectorAll(".page-break").length;
      setPageCount(Math.max(1, breaks + 1, Math.ceil((total - 2) / px.height)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(dom);
    return () => ro.disconnect();
  }, [editor, px.top, px.bottom, px.height, setPageCount]);

  useEffect(() => {
    editor.view.dom.setAttribute("spellcheck", String(spellcheck));
  }, [editor, spellcheck]);

  // Ctrl + mouse wheel zooms the page.
  useEffect(() => {
    if (!scroller) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoomStep(e.deltaY < 0 ? 1 : -1);
    };
    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", onWheel);
  }, [scroller]);

  const paperStyle = {
    width: px.width,
    minHeight: pageCount * px.height,
    padding: `${px.top}px ${px.right}px ${px.bottom}px ${px.left}px`,
    "--doc-font": fontStack(page.fontFamily),
    "--doc-size": `${page.fontSize}pt`,
  } as CSSProperties;

  return (
    <div
      id="canvas-scroll"
      ref={setScroller}
      className="relative min-h-0 flex-1 overflow-auto"
      onMouseDown={(e) => {
        // Clicking the grey area around the page puts the caret at the end, like Word.
        if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.canvasPad !== undefined) {
          e.preventDefault();
          editor.commands.focus("end");
        }
      }}
    >
      <div data-canvas-pad className="flex min-h-full w-max min-w-full justify-center px-8 py-8" style={{ zoom }}>
        <div
          className="pluto-doc pluto-editor relative shrink-0 cursor-text bg-paper shadow-paper transition-[width,padding] duration-200"
          style={paperStyle}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault();
              editor.commands.focus("end");
            }
          }}
        >
          <EditorContent editor={editor} />
          {showGuides &&
            !focusMode &&
            Array.from({ length: pageCount - 1 }, (_, i) => (
              <div
                key={i}
                aria-hidden
                className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[color-mix(in_srgb,var(--pd-ink)_16%,transparent)]"
                style={{ top: (i + 1) * px.height }}
              >
                <span className="absolute right-3 top-1 font-sans text-[10px] font-medium uppercase tracking-wider text-[color-mix(in_srgb,var(--pd-ink)_35%,transparent)]">
                  Page {i + 2}
                </span>
              </div>
            ))}
        </div>
      </div>
      {scroller && <BubbleMenus editor={editor} scroller={scroller} />}
    </div>
  );
}
