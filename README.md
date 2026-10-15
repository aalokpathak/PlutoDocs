# PlutoDocs

A modern rich-text document processor from the **Pluto** software suite, built with
Tauri v2, React 19, TypeScript, Tailwind CSS v4 and Tiptap 3.

- **Windows 11 Fluent UI**: frameless window with native caption buttons, Mica backdrop,
  light/dark/system themes, accent colours, and a ribbon with a contextual *Table Design* tab.
- **Rich-text editing**: H1–H6, bold/italic/underline/strike, sub/superscript, fonts and sizes,
  text colour and highlight, bulleted/numbered/check lists, quotes, syntax-highlighted code blocks,
  tables (resize, merge/split, header rows, shading), resizable and alignable pictures,
  callout boxes, hyperlinks (dialog + bubble menu), page breaks, symbols, date/time, find & replace.
- **Native files**: open and save `.pluto`, `.docx`, `.md`, `.html` and `.txt` through native
  dialogs. Atomic writes on the Rust side mean a crash mid-save never corrupts a file.
- **AutoSave and recovery**: a recovery copy is written about a second after every edit. AutoSave
  (title bar toggle) saves to the open file after a short pause. Versions are snapshotted
  periodically and on every save. Unsaved work is offered back after a crash.
- **Export**: PDF (native WebView2 print engine, vector text), standalone HTML, Markdown
  (GFM: tables, task lists, `> [!NOTE]` callouts) and Word.
- **Distribution**: NSIS setup `.exe`, `.msi`, and a portable `.exe` / `.zip`.

## Getting started

```bash
npm install
npm run app:dev        # desktop app with hot reload
npm run dev            # UI only, in a browser (files download instead of saving in place)
```

Requirements: Node 20+, Rust (stable, MSVC toolchain), and the WebView2 runtime (built into Windows 11).

## Building for Windows

```bash
npm run release
```

This runs `tauri build` and then [`scripts/collect-release.mjs`](scripts/collect-release.mjs),
which gathers everything into `release/`:

| File | What it is |
| --- | --- |
| `PlutoDocs_<v>_x64-setup.exe` | NSIS installer (per-user or per-machine; installs WebView2 if missing) |
| `PlutoDocs_<v>_x64_en-US.msi` | Windows Installer package for managed deployment |
| `PlutoDocs_<v>_x64_portable.exe` | Portable build: runs without installation |
| `PlutoDocs_<v>_x64_portable.zip` | The portable exe plus its `portable` marker file |
| `SHA256SUMS.txt` | Checksums |

The installers come from `bundle.targets` (`nsis`, `msi`) in
[`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json), which also registers `.pluto` files to open
with PlutoDocs. Tauri has no portable bundle target, but the release binary is already self-contained:
frontend assets are embedded and WebView2 ships with Windows. So the portable build is that binary.

**Portable mode** turns on when the exe's file name contains `portable`, or when a file named
`portable` sits next to it. All data (settings, recent files, version history, recovery copies and
the WebView2 profile) then lives in a `PlutoDocs Data` folder beside the exe instead of `%APPDATA%`.

To regenerate icons from `app-icon.svg`: `npm run app:icons`.

## Project layout

```
src/
  App.tsx                    shell: title bar, ribbon, sidebar, canvas, status bar
  editor/
    extensions.ts            Tiptap extension set
    extensions/              callout, resizable image, page break, line spacing, find & replace
    EditorCanvas.tsx         paper, zoom, page guides
    BubbleMenus.tsx          floating text / link / image toolbars
    FindBar.tsx
  components/
    TitleBar.tsx             custom caption bar, AutoSave toggle, theme switcher
    ribbon/                  Home, Insert, Layout, View, Table Design tabs
    sidebar/                 File, Recent, Templates, Outline, Version history, Settings
    StatusBar.tsx            page/word/character counts, save state, zoom
    dialogs/                 link, picture, confirm, recovery, about, toasts
  lib/
    platform.ts              Tauri command bridge (with browser fallbacks)
    documents.ts             new/open/save/save as/export/print/restore
    autosave.ts              recovery backups, AutoSave, version snapshots
    formats/                 .pluto, .docx (import + export), Markdown, HTML, text
src-tauri/src/
  files.rs                   read/write commands with atomic saves
  store.rs                   recent documents, crash recovery, revision snapshots
  pdf.rs                     WebView2 PrintToPdf export
  lib.rs                     window setup (frameless, Mica), portable mode, command registry
```

## The `.pluto` format

UTF-8 JSON: `{ format: "pluto", version: 1, meta: { title, createdAt, modifiedAt, words },
page: { size, orientation, margins, fontFamily, fontSize }, content: <Tiptap JSON> }`.
Pictures are embedded as data URLs, so a `.pluto` file is a single self-contained document.

## Keyboard shortcuts

| Action | Keys |
| --- | --- |
| New / Open / Save / Save as | Ctrl+N · Ctrl+O · Ctrl+S · Ctrl+Shift+S |
| Print / Export PDF | Ctrl+P · Ctrl+Shift+P |
| Find / Replace | Ctrl+F · Ctrl+H |
| Link | Ctrl+K |
| Page break | Ctrl+Enter |
| Font size up / down | Ctrl+] · Ctrl+[ |
| Zoom in / out / reset | Ctrl+= · Ctrl+- · Ctrl+0 (or Ctrl+wheel) |
| Sidebar / Focus mode | Ctrl+\ · F11 |

## Native smoke test (debug builds)

```powershell
$env:PLUTODOCS_SELFTEST_DIR = "C:\temp\pd-selftest"; npm run app:dev
```

The app saves the current document in every format, exports a PDF, reads everything back, exercises
the recovery, revision and recent-file commands, writes `report.json` to that folder, and closes.
Release builds ignore the variable.
