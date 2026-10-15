import type { Editor } from "@tiptap/react";
import { useEffect } from "react";
import { fitPageWidth, toggleFullscreen, zoomStep } from "@/components/ribbon/ViewTab";
import { exportDocument, newDocument, openDocument, printDocument, saveDocument, saveDocumentAs } from "@/lib/documents";
import { inTauri } from "@/lib/platform";
import { useApp } from "@/store/app";

/** App-level keyboard shortcuts (formatting shortcuts live in the editor extensions). */
export function useShortcuts(editor: Editor | null) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const app = useApp.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const run = (fn: () => unknown) => {
        e.preventDefault();
        e.stopPropagation();
        void fn();
      };

      if (e.key === "Escape" && app.focusMode && !app.dialog) return run(() => app.setFocusMode(false));
      if (e.key === "F11") return run(() => app.setFocusMode(!app.focusMode));
      // Browser-ish reload/navigation keys would discard the document.
      if (inTauri && (e.key === "F5" || (mod && key === "r") || (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")))) {
        return run(() => undefined);
      }
      if (!mod || app.dialog) return;

      if (key === "n" && !e.shiftKey) return run(() => newDocument());
      if (key === "o") return run(() => openDocument());
      if (key === "s" && e.shiftKey) return run(() => saveDocumentAs());
      if (key === "s") return run(() => saveDocument());
      if (key === "p" && e.shiftKey) return run(() => exportDocument("pdf"));
      if (key === "p") return run(() => printDocument());
      if (key === "f") return run(() => app.openFind(false));
      if (key === "h") return run(() => app.openFind(true));
      if (key === "k" && editor) return run(() => app.openDialog({ kind: "link" }));
      if (key === "\\") return run(() => app.toggleSidebar());
      if (key === "=" || key === "+") return run(() => zoomStep(1));
      if (key === "-") return run(() => zoomStep(-1));
      if (key === "0") return run(() => app.setZoom(1));
      if (key === "9" && e.altKey) return run(fitPageWidth);
      if (e.shiftKey && key === "f11") return run(toggleFullscreen);
      if ((key === "]" || key === "[") && editor) {
        // Grow/shrink font by 1pt like Word's Ctrl+] / Ctrl+[.
        return run(() => {
          const current = parseFloat((editor.getAttributes("textStyle").fontSize as string | undefined) ?? "") || app.doc.page.fontSize;
          const next = Math.max(1, current + (key === "]" ? 1 : -1));
          editor.chain().focus().setFontSize(`${next}pt`).run();
        });
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [editor]);
}
