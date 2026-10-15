import { useEditorState, type Editor } from "@tiptap/react";
import { clsx } from "clsx";
import { Loader2, Monitor, Moon, Redo2, Save, Search, Sun, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { saveDocument } from "@/lib/documents";
import { inTauri, platform, screenshotScene } from "@/lib/platform";
import type { Theme } from "@/lib/types";
import { isDirty, useApp } from "@/store/app";
import { Switch } from "./ui";

// Segoe Fluent Icons glyphs used by native Windows 11 caption buttons.
const GLYPHS = { minimize: "", maximize: "", restore: "", close: "" };

function WindowControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!inTauri) return;
    let unlisten: (() => void) | undefined;
    void (async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      setMaximized(await win.isMaximized());
      unlisten = await win.onResized(async () => setMaximized(await win.isMaximized()));
    })();
    return () => unlisten?.();
  }, []);

  const run = async (action: "minimize" | "toggleMaximize" | "close") => {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    // close() raises CloseRequested, where unsaved changes are handled.
    await getCurrentWindow()[action]();
  };

  const base = "flex h-full w-[46px] items-center justify-center text-[10px] text-fg transition-colors duration-100";
  const glyphFont = { fontFamily: '"Segoe Fluent Icons", "Segoe MDL2 Assets"' };

  return (
    <div className="flex h-full">
      <button aria-label="Minimize" className={clsx(base, "hover:bg-hover active:bg-pressed")} style={glyphFont} onClick={() => run("minimize")}>
        {GLYPHS.minimize}
      </button>
      <button
        aria-label={maximized ? "Restore" : "Maximize"}
        className={clsx(base, "hover:bg-hover active:bg-pressed")}
        style={glyphFont}
        onClick={() => run("toggleMaximize")}
      >
        {maximized ? GLYPHS.restore : GLYPHS.maximize}
      </button>
      <button
        aria-label="Close"
        className={clsx(base, "hover:bg-[#c42b1c] hover:text-white active:bg-[#b22a1b]")}
        style={glyphFont}
        onClick={() => run("close")}
      >
        {GLYPHS.close}
      </button>
    </div>
  );
}

const THEMES: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Light theme" },
  { value: "dark", icon: Moon, label: "Dark theme" },
  { value: "system", icon: Monitor, label: "Use system theme" },
];

export function ThemeSwitcher() {
  const theme = useApp((s) => s.settings.theme);
  const updateSettings = useApp((s) => s.updateSettings);
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-stroke bg-layer-alt p-0.5" role="radiogroup" aria-label="Theme">
      {THEMES.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          role="radio"
          aria-checked={theme === value}
          title={label}
          aria-label={label}
          onClick={() => updateSettings({ theme: value })}
          className={clsx(
            "flex size-6 items-center justify-center rounded-md transition-all",
            theme === value ? "bg-layer-solid text-accent shadow-card" : "text-fg-3 hover:text-fg",
          )}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}

function QuickAccess({ editor }: { editor: Editor }) {
  const { canUndo, canRedo } = useEditorState({
    editor,
    selector: ({ editor: e }) => ({ canUndo: e.can().undo(), canRedo: e.can().redo() }),
  });
  const saving = useApp((s) => s.doc.saving);
  const btn = "flex size-7 items-center justify-center rounded-md text-fg-2 transition-colors hover:bg-hover hover:text-fg disabled:opacity-35 disabled:hover:bg-transparent";
  return (
    <div className="flex items-center gap-0.5">
      <button className={btn} title="Save (Ctrl+S)" aria-label="Save" onClick={() => void saveDocument()}>
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
      </button>
      <button className={btn} title="Undo (Ctrl+Z)" aria-label="Undo" disabled={!canUndo} onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 className="size-4" />
      </button>
      <button className={btn} title="Redo (Ctrl+Y)" aria-label="Redo" disabled={!canRedo} onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 className="size-4" />
      </button>
    </div>
  );
}

function DocumentTitle() {
  const doc = useApp((s) => s.doc);
  const dirty = isDirty(doc);
  let status = "Not saved yet";
  if (doc.saving) status = "Saving…";
  else if (doc.saveError) status = "Save failed";
  else if (doc.path && !dirty) status = "Saved";
  else if (doc.path && dirty) status = "Edited";
  else if (!doc.path && doc.lastBackupAt) status = "Backed up · not saved";

  return (
    <div data-tauri-drag-region className="flex min-w-0 items-center gap-2 text-[12.5px]">
      <span data-tauri-drag-region className="truncate font-semibold" title={doc.path ?? doc.name}>
        {doc.name}
      </span>
      <span
        data-tauri-drag-region
        className={clsx(
          "flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px]",
          doc.saveError ? "bg-danger/10 text-danger" : "text-fg-3",
        )}
      >
        <span className={clsx("size-1.5 rounded-full", doc.saveError ? "bg-danger" : dirty ? "bg-warning" : "bg-success")} />
        {status}
      </span>
    </div>
  );
}

export function TitleBar({ editor }: { editor: Editor | null }) {
  const autoSave = useApp((s) => s.settings.autoSave);
  const updateSettings = useApp((s) => s.updateSettings);
  const openFind = useApp((s) => s.openFind);
  const portable = useApp((s) => s.appInfo?.portable);
  const hasPath = useApp((s) => !!s.doc.path);
  const name = useApp((s) => s.doc.name);
  const dirty = useApp((s) => isDirty(s.doc));

  useEffect(() => {
    void platform.setWindowTitle(`${dirty ? "• " : ""}${name} - PlutoDocs`);
  }, [name, dirty]);

  return (
    <header data-tauri-drag-region className="relative flex h-11 shrink-0 items-center gap-3 bg-chrome pl-3.5">
      <div data-tauri-drag-region className="flex items-center gap-2">
        <img src="/app-icon.svg" alt="" className="pointer-events-none size-[22px]" draggable={false} />
        <span data-tauri-drag-region className="font-display text-[13px] font-semibold tracking-tight">
          PlutoDocs
        </span>
        {portable && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10.5px] font-semibold text-accent">Portable</span>}
        {!inTauri && !screenshotScene && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10.5px] font-semibold text-accent">Browser preview</span>}
      </div>

      <div
        className="flex items-center gap-2 rounded-md py-1 pl-2 pr-1.5"
        title={hasPath ? "Save changes to this file automatically" : "AutoSave starts once the document has been saved to a file"}
      >
        <span className="text-[12px] text-fg-2">AutoSave</span>
        <Switch checked={autoSave} onChange={(v) => updateSettings({ autoSave: v })} label="AutoSave" />
      </div>
      {editor && <QuickAccess editor={editor} />}

      <div data-tauri-drag-region className="flex h-full min-w-0 flex-1 items-center justify-center px-4">
        <DocumentTitle />
      </div>

      <button
        onClick={() => openFind(false)}
        className="hidden h-7 w-56 items-center gap-2 rounded-md border border-stroke bg-layer px-2.5 text-[12px] text-fg-3 transition-colors hover:border-stroke-strong hover:text-fg-2 lg:flex"
      >
        <Search className="size-3.5" /> Search in document
        <span className="ml-auto text-[11px]">Ctrl+F</span>
      </button>
      <ThemeSwitcher />
      {inTauri || screenshotScene ? <WindowControls /> : <div className="w-1" />}
    </header>
  );
}
