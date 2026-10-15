import { useEditorState, type Editor } from "@tiptap/react";
import { clsx } from "clsx";
import { CloudCheck, Focus, HardDriveDownload, Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { pagePixels } from "@/lib/page";
import { isDirty, useApp } from "@/store/app";
import { zoomStep, ZOOM_STEPS } from "./ribbon/ViewTab";
import { Popover, usePopover } from "./ui";

function useClock(intervalMs = 30_000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
}

export function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 45_000) return "just now";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} min ago`;
  return new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function useDocStats(editor: Editor) {
  return useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const { from, to, empty } = e.state.selection;
      const cc = e.storage.characterCount;
      const text = e.state.doc.textBetween(0, e.state.doc.content.size, "\n", " ");
      let paragraphs = 0;
      e.state.doc.descendants((n) => {
        if (n.isTextblock && n.textContent.trim()) paragraphs++;
        return !n.isTextblock;
      });
      const selectedText = empty ? "" : e.state.doc.textBetween(from, to, " ", " ");
      return {
        words: cc.words() as number,
        characters: cc.characters() as number,
        charactersNoSpaces: text.replace(/\s/g, "").length,
        paragraphs,
        selectedWords: selectedText ? selectedText.trim().split(/\s+/).filter(Boolean).length : 0,
        caret: from,
      };
    },
  });
}

/** Which page the caret is on, from its on-screen position inside the paper. */
function useCurrentPage(editor: Editor, caret: number): number {
  const page = useApp((s) => s.doc.page);
  const zoom = useApp((s) => s.zoom);
  const [current, setCurrent] = useState(1);
  useEffect(() => {
    try {
      const paper = editor.view.dom.closest(".pluto-editor") as HTMLElement | null;
      if (!paper) return;
      const top = editor.view.coordsAtPos(caret).top - paper.getBoundingClientRect().top;
      setCurrent(Math.max(1, Math.floor(top / zoom / pagePixels(page).height) + 1));
    } catch {
      /* position not rendered yet */
    }
  }, [editor, caret, page, zoom]);
  return current;
}

function SaveInfo() {
  useClock();
  const doc = useApp((s) => s.doc);
  const autoSave = useApp((s) => s.settings.autoSave);
  if (doc.saving) return <span>Saving…</span>;
  if (doc.path && !isDirty(doc) && doc.lastSavedAt) {
    return (
      <span className="flex items-center gap-1.5">
        <CloudCheck className="size-3.5 text-success" /> {autoSave ? "Auto-saved" : "Saved"} {relativeTime(doc.lastSavedAt)}
      </span>
    );
  }
  if (doc.lastBackupAt) {
    return (
      <span className="flex items-center gap-1.5" title="A recovery copy is kept in case PlutoDocs closes unexpectedly">
        <HardDriveDownload className="size-3.5" /> Recovery copy {relativeTime(doc.lastBackupAt)}
      </span>
    );
  }
  return null;
}

/** Slider position is logarithmic so 100% sits in the middle of 25%–400%. */
const toSlider = (z: number) => Math.round(((Math.log2(z) + 2) / 4) * 100);
const fromSlider = (v: number) => Math.pow(2, (v / 100) * 4 - 2);

export function StatusBar({ editor }: { editor: Editor }) {
  const stats = useDocStats(editor);
  const pageCount = useApp((s) => s.pageCount);
  const zoom = useApp((s) => s.zoom);
  const setZoom = useApp((s) => s.setZoom);
  const setFocusMode = useApp((s) => s.setFocusMode);
  const currentPage = useCurrentPage(editor, stats.caret);
  const pop = usePopover();
  const readingMin = Math.max(1, Math.round(stats.words / 230));

  const item = "flex h-full items-center rounded px-2 transition-colors hover:bg-hover";
  return (
    <footer className="flex h-7 shrink-0 items-center gap-0.5 bg-chrome px-2 text-[11.5px] text-fg-2">
      <span className="tabular px-2">
        Page {Math.min(currentPage, pageCount)} of {pageCount}
      </span>
      <button ref={pop.anchorRef} type="button" onClick={pop.toggle} className={clsx(item, "tabular")} title="Word count">
        {stats.selectedWords ? `${stats.selectedWords.toLocaleString()} of ` : ""}
        {stats.words.toLocaleString()} {stats.words === 1 ? "word" : "words"}
      </button>
      <span className="tabular px-2">{stats.characters.toLocaleString()} characters</span>
      <Popover open={pop.open} onClose={pop.close} anchorRef={pop.anchorRef}>
        <div className="w-[260px] p-3">
          <div className="mb-2 font-display text-[14px] font-semibold text-fg">Word count</div>
          {[
            ["Pages", pageCount],
            ["Words", stats.words],
            ["Characters (no spaces)", stats.charactersNoSpaces],
            ["Characters (with spaces)", stats.characters],
            ["Paragraphs", stats.paragraphs],
            ["Reading time", `~${readingMin} min`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between py-1 text-[12.5px]">
              <span className="text-fg-2">{k}</span>
              <span className="tabular font-medium text-fg">{typeof v === "number" ? v.toLocaleString() : v}</span>
            </div>
          ))}
        </div>
      </Popover>
      <span className="px-2 text-fg-3">English (United States)</span>

      <div className="ml-auto flex h-full items-center gap-0.5">
        <span className="px-2">
          <SaveInfo />
        </span>
        <button type="button" className={item} title="Focus mode (F11)" onClick={() => setFocusMode(true)}>
          <Focus className="mr-1.5 size-3.5" /> Focus
        </button>
        <button type="button" className={clsx(item, "px-1.5")} aria-label="Zoom out" onClick={() => zoomStep(-1)}>
          <Minus className="size-3.5" />
        </button>
        <input
          type="range"
          aria-label="Zoom"
          min={0}
          max={100}
          value={toSlider(zoom)}
          onChange={(e) => {
            const z = fromSlider(Number(e.target.value));
            // Snap to 100% near the centre.
            setZoom(Math.abs(z - 1) < 0.04 ? 1 : z);
          }}
          className="h-1 w-24 cursor-pointer accent-[var(--pd-accent)]"
          list="zoom-ticks"
        />
        <datalist id="zoom-ticks">
          {ZOOM_STEPS.filter((z) => z === 1).map((z) => (
            <option key={z} value={toSlider(z)} />
          ))}
        </datalist>
        <button type="button" className={clsx(item, "px-1.5")} aria-label="Zoom in" onClick={() => zoomStep(1)}>
          <Plus className="size-3.5" />
        </button>
        <button type="button" className={clsx(item, "tabular w-12 justify-center")} title="Reset zoom to 100%" onClick={() => setZoom(1)}>
          {Math.round(zoom * 100)}%
        </button>
      </div>
    </footer>
  );
}
