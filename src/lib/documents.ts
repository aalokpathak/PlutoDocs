/**
 * Document lifecycle: new / open / save / save as / export / print / restore.
 * UI components call these; they talk to the editor, the store and the platform.
 */
import type { Editor, JSONContent } from "@tiptap/react";
import { EditorState } from "@tiptap/pm/state";
import { getEditor, wordCount } from "@/editor/instance";
import { formatFromPath, loadDocument, LOSSY_FORMATS, serializePluto, writeDocument, type LoadedDocument } from "@/lib/formats";
import { fontStack, pageInches } from "@/lib/page";
import { errorMessage, fileName, FORMAT_FILTERS, inTauri, platform, type RecoveryEntry } from "@/lib/platform";
import type { DocFormat, ExportFormat, PageSetup, RecoveryPayload } from "@/lib/types";
import { accentRgb, isDirty, newUntitledDoc, useApp, type DocState } from "@/store/app";

const app = () => useApp.getState();

/** Stable id for a file's revision history: a hash of its normalized path. */
export function docIdForPath(path: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const s = path.toLowerCase().replace(/\//g, "\\");
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x5bd1e995);
  }
  return `f-${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
}

function requireEditor(): Editor {
  const editor = getEditor();
  if (!editor) throw new Error("The editor is not ready yet");
  return editor;
}

function baseName(name: string) {
  return name.replace(/\.[^.]+$/, "");
}

/** Loads content as a fresh document: not dirty, and with an empty undo history. */
function setEditorContent(editor: Editor, content: string | JSONContent) {
  editor.commands.setContent(content, { emitUpdate: false });
  const { doc, plugins, schema } = editor.state;
  editor.view.updateState(EditorState.create({ doc, plugins, schema }));
  editor.commands.focus("start");
}

function payloadFor(editor: Editor, doc: DocState): string {
  return JSON.stringify(serializePluto(editor.getJSON(), doc.page, baseName(doc.name), wordCount(editor), doc.createdAt));
}

export function recoveryPayload(editor: Editor, doc: DocState): string {
  const payload: RecoveryPayload = {
    ...serializePluto(editor.getJSON(), doc.page, baseName(doc.name), wordCount(editor), doc.createdAt),
    recovery: { docId: doc.docId, path: doc.path, name: doc.name, docFormat: doc.format },
  };
  return JSON.stringify(payload);
}

// ------------------------------------------------------------------ guard

/** Asks to save unsaved changes. Resolves false when the user cancels. */
export async function confirmDiscard(action = "continuing"): Promise<boolean> {
  const { doc } = app();
  if (!isDirty(doc)) return true;
  const choice = await app().confirm({
    title: "Save your changes?",
    body: `“${doc.name}” has unsaved changes. Do you want to save them before ${action}?`,
    actions: [
      { id: "save", label: "Save", tone: "primary" },
      { id: "discard", label: "Don't save", tone: "danger" },
      { id: "cancel", label: "Cancel" },
    ],
  });
  if (choice === "save") return saveDocument();
  if (choice === "discard") {
    await platform.recoveryClear(doc.docId).catch(() => undefined);
    return true;
  }
  return false;
}

// ------------------------------------------------------------------ new / open

export async function newDocument(template?: { html: string; name?: string }) {
  if (!(await confirmDiscard("creating a new document"))) return;
  const editor = requireEditor();
  const doc = newUntitledDoc(app().settings.defaultPage);
  if (template?.name) doc.name = template.name;
  app().replaceDoc(doc);
  setEditorContent(editor, template?.html ?? "");
}

function applyLoaded(editor: Editor, loaded: LoadedDocument, patch: Partial<DocState>) {
  const doc: DocState = {
    ...newUntitledDoc(loaded.page ?? app().settings.defaultPage),
    createdAt: loaded.createdAt ?? Date.now(),
    ...patch,
  };
  app().replaceDoc(doc);
  setEditorContent(editor, loaded.content);
}

export async function openDocument(path?: string) {
  if (!(await confirmDiscard("opening another document"))) return;
  const editor = requireEditor();
  let target = path;
  if (!target) {
    const picked = await platform.pickOpen([
      { name: "All supported documents", extensions: ["pluto", "docx", "md", "markdown", "html", "htm", "txt"] },
      ...Object.values(FORMAT_FILTERS),
    ]);
    if (!picked) return;
    target = picked.path;
  }
  const format = formatFromPath(target);
  if (!format) {
    app().toast({ tone: "error", title: "Unsupported file type", body: fileName(target) });
    return;
  }
  try {
    const loaded = await loadDocument(target, format);
    const docId = docIdForPath(target);
    applyLoaded(editor, loaded, { docId, path: target, name: fileName(target), format, lastSavedAt: Date.now() });
    await platform.recentAdd(target).catch(() => undefined);
    void app().refreshRecent();
    app().bumpHistory();
    for (const w of loaded.warnings) app().toast({ tone: "info", title: "Opened with changes", body: w });
  } catch (e) {
    app().toast({ tone: "error", title: `Couldn't open ${fileName(target)}`, body: errorMessage(e) });
    // A file that vanished should not linger in Recent.
    if (!(await platform.pathExists(target).catch(() => true))) {
      await platform.recentRemove(target).catch(() => undefined);
      void app().refreshRecent();
    }
  }
}

/**
 * Opens a file dropped onto the window. Drag & drop does not reveal the file's
 * location, so it opens as an untitled copy (Save asks where to put it).
 */
export async function openDroppedFile(file: File) {
  const format = formatFromPath(file.name);
  if (!format) return;
  if (!(await confirmDiscard("opening another document"))) return;
  const editor = requireEditor();
  try {
    const loaded = await loadDocument(platform.registerFile(file), format);
    applyLoaded(editor, loaded, { name: file.name, format });
    app().toast({ tone: "info", title: `Opened ${file.name}`, body: "Use Save to choose where to keep it, or File → Open to edit the original in place." });
  } catch (e) {
    app().toast({ tone: "error", title: `Couldn't open ${file.name}`, body: errorMessage(e) });
  }
}

// ------------------------------------------------------------------ save

let snapshotState = { docId: "", changeCount: -1, at: 0 };

/** Records a revision snapshot unless nothing changed since the last one. */
export async function createSnapshot(label: string, force = false) {
  const editor = getEditor();
  const { doc, settings } = app();
  if (!editor) return;
  if (!force && snapshotState.docId === doc.docId && snapshotState.changeCount === doc.changeCount) return;
  if (!force && editor.isEmpty) return;
  try {
    await platform.revisionCreate(doc.docId, label, wordCount(editor), payloadFor(editor, doc), settings.maxSnapshots);
    snapshotState = { docId: doc.docId, changeCount: doc.changeCount, at: Date.now() };
    app().bumpHistory();
  } catch (e) {
    console.warn("Snapshot failed", e);
  }
}

export function lastSnapshotAt(docId: string) {
  return snapshotState.docId === docId ? snapshotState.at : 0;
}

async function writeTo(path: string, format: DocFormat, opts: { silent?: boolean } = {}): Promise<boolean> {
  const editor = requireEditor();
  const before = app().doc;
  const changeCount = before.changeCount;
  app().setDoc({ saving: true, saveError: null });
  try {
    await writeDocument(editor, path, format, {
      title: baseName(fileName(path)),
      page: before.page,
      createdAt: before.createdAt,
      accentRgb: accentRgb(app().settings.accent),
    });
  } catch (e) {
    const message = errorMessage(e);
    app().setDoc({ saving: false, saveError: message });
    app().toast({ tone: "error", title: "Save failed", body: message });
    return false;
  }

  const newId = docIdForPath(path);
  if (before.docId !== newId) {
    // First save of an untitled document (or Save As): carry its history along.
    await platform.revisionsMigrate(before.docId, newId).catch(() => undefined);
    await platform.recoveryClear(before.docId).catch(() => undefined);
  }
  if (!platform.savesInPlace) {
    // Browser preview: saving downloads a copy, nothing is overwritten.
    app().setDoc({ saving: false, savedChangeCount: changeCount, lastSavedAt: Date.now() });
    if (!opts.silent) app().toast({ tone: "success", title: "Downloaded", body: fileName(path) });
    return true;
  }
  app().setDoc({
    docId: newId,
    path,
    name: fileName(path),
    format,
    saving: false,
    savedChangeCount: changeCount,
    lastSavedAt: Date.now(),
  });
  await platform.recoveryClear(newId).catch(() => undefined);
  await platform.recentAdd(path).catch(() => undefined);
  void app().refreshRecent();
  if (!opts.silent) {
    void createSnapshot("Saved version");
    if (LOSSY_FORMATS.includes(format)) {
      app().toast({ tone: "info", title: `Saved as ${format.toUpperCase()}`, body: "Some formatting (colours, fonts, layout) isn't kept in this format." });
    }
  }
  return true;
}

export async function saveDocument(opts: { silent?: boolean } = {}): Promise<boolean> {
  const { doc } = app();
  if (!doc.path || !platform.savesInPlace) return saveDocumentAs();
  return writeTo(doc.path, doc.format, opts);
}

export async function saveDocumentAs(format?: DocFormat): Promise<boolean> {
  const { doc } = app();
  const target = format ?? doc.format;
  const filters = [FORMAT_FILTERS[target], ...Object.values(FORMAT_FILTERS).filter((f) => f !== FORMAT_FILTERS[target])];
  const suggested = `${baseName(doc.name)}.${FORMAT_FILTERS[target].extensions[0]}`;
  let path = await platform.pickSave(suggested, filters);
  if (!path) return false;
  let chosen = formatFromPath(path);
  if (!chosen) {
    path = `${path}.${FORMAT_FILTERS[target].extensions[0]}`;
    chosen = target;
  }
  return writeTo(path, chosen);
}

// ------------------------------------------------------------------ export / print

async function preparePrintRoot(editor: Editor, page: PageSetup): Promise<() => void> {
  const root = document.getElementById("print-root")!;
  const clone = editor.view.dom.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("[contenteditable]").forEach((el) => el.removeAttribute("contenteditable"));
  clone.querySelectorAll(".ProseMirror-selectednode, .is-selected").forEach((el) => el.classList.remove("ProseMirror-selectednode", "is-selected"));
  clone.querySelectorAll(".ProseMirror-gapcursor, .ProseMirror-trailingBreak").forEach((el) => el.remove());

  const article = document.createElement("article");
  article.className = "pluto-doc";
  article.style.setProperty("--doc-font", fontStack(page.fontFamily));
  article.style.setProperty("--doc-size", `${page.fontSize}pt`);
  article.append(...Array.from(clone.childNodes));
  root.replaceChildren(article);

  const inches = pageInches(page);
  const style = document.createElement("style");
  style.textContent = `@page { size: ${inches.width}in ${inches.height}in; margin: ${inches.top}in ${inches.right}in ${inches.bottom}in ${inches.left}in; }`;
  document.head.append(style);

  await Promise.all(Array.from(article.querySelectorAll("img")).map((img) => img.decode().catch(() => undefined)));
  return () => {
    root.replaceChildren();
    style.remove();
  };
}

export async function printDocument() {
  const editor = requireEditor();
  const cleanup = await preparePrintRoot(editor, app().doc.page);
  try {
    window.print();
  } finally {
    // window.print() blocks until the dialog closes in Chromium/WebView2.
    setTimeout(cleanup, 500);
  }
}

/** Renders the document to a PDF file through WebView2 (Tauri only). */
export async function exportPdfTo(path: string) {
  const editor = requireEditor();
  const { page } = app().doc;
  const cleanup = await preparePrintRoot(editor, page);
  try {
    const inches = pageInches(page);
    await platform.exportPdf(path, {
      // WebView2 takes portrait dimensions and rotates for landscape itself.
      pageWidth: Math.min(inches.width, inches.height),
      pageHeight: Math.max(inches.width, inches.height),
      marginTop: inches.top,
      marginRight: inches.right,
      marginBottom: inches.bottom,
      marginLeft: inches.left,
      landscape: page.orientation === "landscape",
    });
  } finally {
    cleanup();
  }
}

const EXPORT_LABEL: Record<ExportFormat, string> = { pdf: "PDF", html: "HTML", md: "Markdown", docx: "Word", txt: "Plain text" };

export async function exportDocument(format: ExportFormat) {
  const editor = requireEditor();
  const { doc } = app();
  if (format === "pdf" && !inTauri) {
    // Browsers can only produce PDFs through the print dialog.
    app().toast({ tone: "info", title: "Choose “Save as PDF” in the print dialog" });
    return printDocument();
  }
  const ext = format === "pdf" ? "pdf" : FORMAT_FILTERS[format].extensions[0];
  const filter = format === "pdf" ? { name: "PDF Document", extensions: ["pdf"] } : FORMAT_FILTERS[format];
  let path = await platform.pickSave(`${baseName(doc.name)}.${ext}`, [filter]);
  if (!path) return;
  if (!path.toLowerCase().endsWith(`.${ext}`) && !(format === "html" && /\.htm$/i.test(path))) path += `.${ext}`;
  try {
    if (format === "pdf") await exportPdfTo(path);
    else
      await writeDocument(editor, path, format, {
        title: baseName(doc.name),
        page: doc.page,
        createdAt: doc.createdAt,
        accentRgb: accentRgb(app().settings.accent),
      });
    app().toast({ tone: "success", title: `Exported to ${EXPORT_LABEL[format]}`, body: fileName(path) });
  } catch (e) {
    app().toast({ tone: "error", title: "Export failed", body: errorMessage(e) });
  }
}

// ------------------------------------------------------------------ recovery & revisions

export async function restoreRecovery(entry: RecoveryEntry) {
  const editor = requireEditor();
  const data = JSON.parse(entry.payload) as RecoveryPayload;
  const r = data.recovery;
  applyLoaded(
    editor,
    { content: data.content, page: data.page, createdAt: data.meta.createdAt, warnings: [] },
    {
      docId: r.docId,
      path: r.path,
      name: r.name,
      format: r.docFormat,
      // Recovered work is unsaved by definition.
      changeCount: 1,
      savedChangeCount: 0,
    },
  );
  await platform.recoveryClear(entry.docId).catch(() => undefined);
  app().toast({ tone: "success", title: "Document recovered", body: "Save it to keep the recovered changes." });
}

export async function restoreRevision(revisionId: string) {
  const editor = requireEditor();
  const { doc } = app();
  const text = await platform.revisionRead(doc.docId, revisionId);
  const data = JSON.parse(text) as { content: JSONContent; page?: PageSetup };
  // Keep the current state restorable too.
  await createSnapshot("Before restore", true);
  editor.chain().setContent(data.content, { emitUpdate: true }).run();
  if (data.page) app().setPage(data.page);
  app().toast({ tone: "success", title: "Version restored", body: "Use Undo (Ctrl+Z) to go back." });
}

/** Closes the window, asking about unsaved changes first. */
export async function requestClose(destroy: () => Promise<void>) {
  if (!(await confirmDiscard("closing"))) return;
  const editor = getEditor();
  const { doc } = app();
  if (editor && !isDirty(doc)) await platform.recoveryClear(doc.docId).catch(() => undefined);
  await destroy();
}
