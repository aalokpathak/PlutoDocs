import { useEditor } from "@tiptap/react";
import { clsx } from "clsx";
import { Minimize2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialogs, Toasts } from "@/components/dialogs/Dialogs";
import { Ribbon } from "@/components/ribbon/Ribbon";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { StatusBar } from "@/components/StatusBar";
import { TitleBar } from "@/components/TitleBar";
import { EditorCanvas } from "@/editor/EditorCanvas";
import { buildExtensions } from "@/editor/extensions";
import { FindBar } from "@/editor/FindBar";
import { setEditor } from "@/editor/instance";
import { useAutosave } from "@/lib/autosave";
import { openDocument, openDroppedFile, requestClose } from "@/lib/documents";
import { formatFromPath } from "@/lib/formats";
import { openExternal } from "@/lib/links";
import { inTauri, platform, screenshotScene } from "@/lib/platform";
import { useShortcuts } from "@/lib/shortcuts";
import { isDirty, useApp } from "@/store/app";

const WELCOME = `
<h1>Welcome to PlutoDocs</h1>
<p>A fast, modern writing space from the Pluto suite. Everything you see here is editable — select this text and start typing.</p>
<div data-callout="info"><p><strong>Tip:</strong> open the <strong>File</strong> menu to open <strong>.docx</strong>, <strong>Markdown</strong>, <strong>HTML</strong> or text files, or pick a template from the sidebar.</p></div>
<h2>What you can do</h2>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="true"><p>Format text with the ribbon or the floating toolbar that appears when you select words</p></li>
<li data-type="taskItem" data-checked="false"><p>Insert tables, pictures, callouts and code from the <strong>Insert</strong> tab</p></li>
<li data-type="taskItem" data-checked="false"><p>Export to <mark>PDF, HTML or Markdown</mark> from <strong>File → Export</strong></p></li>
</ul>
<blockquote><p>Your work is backed up seconds after every change, and versions are kept in <strong>Version history</strong>.</p></blockquote>
`;

function FocusOverlay() {
  const setFocusMode = useApp((s) => s.setFocusMode);
  return (
    <>
      <div data-tauri-drag-region className="fixed inset-x-0 top-0 z-20 h-3" />
      <button
        type="button"
        onClick={() => setFocusMode(false)}
        className="glass fixed right-5 top-4 z-30 flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] text-fg-2 opacity-40 transition-opacity hover:opacity-100"
      >
        <Minimize2 className="size-3.5" /> Exit focus · Esc
      </button>
    </>
  );
}

export function App() {
  const focusMode = useApp((s) => s.focusMode);
  const [dragging, setDragging] = useState(false);

  const editor = useEditor({
    extensions: buildExtensions(),
    content: WELCOME,
    autofocus: "start",
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: { class: "pluto-prose", spellcheck: "true" },
      handleClick: (_view, _pos, event) => {
        // Ctrl+click follows links, as in Word.
        const link = (event.target as HTMLElement).closest("a[href]");
        if (link && (event.ctrlKey || event.metaKey)) {
          void openExternal(link.getAttribute("href") ?? "");
          return true;
        }
        return false;
      },
    },
  });

  useEffect(() => {
    setEditor(editor);
    if (import.meta.env.DEV) (window as unknown as { __editor: unknown }).__editor = editor;
    return () => setEditor(null);
  }, [editor]);

  useAutosave(editor);
  useShortcuts(editor);

  // Startup: platform info, file passed on the command line, crash recovery.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const app = useApp.getState();
      await app.init();
      if (cancelled) return;
      if (screenshotScene) {
        const { stageScene } = await import("@/dev/screenshots");
        return stageScene(screenshotScene);
      }
      const selftestDir = useApp.getState().appInfo?.selftestDir;
      if (selftestDir) {
        const { runSelfTest } = await import("@/lib/selftest");
        return runSelfTest(selftestDir);
      }
      const launch = useApp.getState().appInfo?.launchFile;
      if (launch) await openDocument(launch);
      const entries = (await platform.recoveryList().catch(() => [])).filter((e) => e.docId !== useApp.getState().doc.docId);
      if (entries.length && !cancelled) useApp.getState().openDialog({ kind: "recovery", entries });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Closing the window asks about unsaved changes first.
  useEffect(() => {
    if (!inTauri) {
      const onBeforeUnload = (e: BeforeUnloadEvent) => {
        if (isDirty(useApp.getState().doc)) e.preventDefault();
      };
      window.addEventListener("beforeunload", onBeforeUnload);
      return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }
    let unlisten: (() => void) | undefined;
    void (async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      unlisten = await win.onCloseRequested(async (event) => {
        event.preventDefault();
        await requestClose(() => win.destroy());
      });
    })();
    return () => unlisten?.();
  }, []);

  // Dropping a document onto the window opens it (pictures dropped on the page are inserted by the editor).
  const isDocDrag = (e: React.DragEvent) => Array.from(e.dataTransfer.items).some((i) => i.kind === "file" && !i.type.startsWith("image/"));
  const onDrop = (e: React.DragEvent) => {
    setDragging(false);
    const file = Array.from(e.dataTransfer.files).find((f) => formatFromPath(f.name));
    if (!file) return;
    e.preventDefault();
    e.stopPropagation();
    void openDroppedFile(file);
  };

  return (
    <div
      className={clsx("flex h-full flex-col", focusMode && "focus-mode")}
      onDragOver={(e) => {
        if (!isDocDrag(e)) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDropCapture={onDrop}
    >
      {!focusMode && <TitleBar editor={editor} />}
      {!focusMode && editor && <Ribbon editor={editor} />}
      <div className="flex min-h-0 flex-1">
        {!focusMode && editor && <Sidebar editor={editor} />}
        <main
          className={clsx(
            "relative flex min-w-0 flex-1 flex-col overflow-hidden bg-content",
            !focusMode && "rounded-tl-xl border-l border-t border-stroke",
          )}
        >
          {editor && <FindBar editor={editor} />}
          {editor && <EditorCanvas editor={editor} />}
          {dragging && (
            <div className="pointer-events-none absolute inset-3 z-40 flex animate-fade-in items-center justify-center rounded-xl border-2 border-dashed border-accent bg-accent-soft text-[15px] font-medium text-accent">
              Drop to open document
            </div>
          )}
        </main>
      </div>
      {!focusMode && editor && <StatusBar editor={editor} />}
      {focusMode && <FocusOverlay />}
      <Dialogs editor={editor} />
      <Toasts />
    </div>
  );
}
