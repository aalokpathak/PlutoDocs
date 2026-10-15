/**
 * Platform layer. Inside the Tauri shell every call goes to the Rust backend;
 * in a plain browser (vite dev without Tauri) it falls back to file pickers,
 * downloads and localStorage so the UI stays fully usable for development.
 */
import type { DocFormat } from "@/lib/types";

export const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Dev only: `?shot=<scene>` stages a README screenshot (see scripts/screenshots.mjs). */
export const screenshotScene = import.meta.env.DEV ? new URLSearchParams(location.search).get("shot") : null;

export interface AppInfo {
  version: string;
  portable: boolean;
  dataDir: string;
  mica: boolean;
  launchFile: string | null;
  /** Debug builds only: folder for the native smoke test (see lib/selftest.ts). */
  selftestDir?: string | null;
}

export interface RecentDoc {
  path: string;
  name: string;
  openedMs: number;
  pinned: boolean;
  exists: boolean;
}

export interface RecoveryEntry {
  docId: string;
  modifiedMs: number;
  payload: string;
}

export interface RevisionInfo {
  id: string;
  createdMs: number;
  label: string;
  words: number;
  size: number;
}

export interface PdfOptions {
  pageWidth: number;
  pageHeight: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  landscape: boolean;
}

/** A file picked for opening: in Tauri a path, in the browser the file itself. */
export interface PickedFile {
  path: string;
  name: string;
  file?: File;
}

export interface FileFilter {
  name: string;
  extensions: string[];
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "Something went wrong";
}

export function fileName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

export function extensionOf(path: string): string {
  const name = fileName(path);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// ------------------------------------------------------------------ browser fallbacks

const ls = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota exceeded or storage unavailable */
    }
  },
};

/** Files picked in the browser or dropped onto the window, keyed by a pseudo-path. */
const browserFiles = new Map<string, File>();

function browserPick(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}

function browserDownload(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const MIME: Record<string, string> = {
  pluto: "application/json",
  html: "text/html",
  md: "text/markdown",
  txt: "text/plain",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};

// ------------------------------------------------------------------ API

export const platform = {
  async appInfo(): Promise<AppInfo> {
    if (!inTauri) {
      return { version: "0.1.0", portable: false, dataDir: "Browser storage", mica: false, launchFile: null };
    }
    return invoke<AppInfo>("get_app_info");
  },

  async pickOpen(filters: FileFilter[]): Promise<PickedFile | null> {
    if (inTauri) {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const path = await open({ multiple: false, directory: false, filters });
      if (!path || Array.isArray(path)) return null;
      return { path, name: fileName(path) };
    }
    const accept = filters.flatMap((f) => f.extensions.map((e) => `.${e}`)).join(",");
    const file = await browserPick(accept);
    if (!file) return null;
    browserFiles.set(file.name, file);
    return { path: file.name, name: file.name, file };
  },

  async pickSave(defaultName: string, filters: FileFilter[]): Promise<string | null> {
    if (inTauri) {
      const { save } = await import("@tauri-apps/plugin-dialog");
      return save({ defaultPath: defaultName, filters });
    }
    // Browser: the "path" is just the download name.
    return defaultName;
  },

  /** Makes an in-memory file (e.g. drag & drop) readable through readText/readBinary. */
  registerFile(file: File): string {
    const key = `memory:${Date.now()}/${file.name}`;
    browserFiles.set(key, file);
    return key;
  },

  async readText(path: string): Promise<string> {
    const file = browserFiles.get(path);
    if (file) return file.text();
    if (inTauri) return invoke<string>("read_text_file", { path });
    throw new Error(`"${path}" is not available in the browser preview`);
  },

  async readBinary(path: string): Promise<ArrayBuffer> {
    const file = browserFiles.get(path);
    if (file) return file.arrayBuffer();
    if (inTauri) return invoke<ArrayBuffer>("read_binary_file", { path });
    throw new Error(`"${path}" is not available in the browser preview`);
  },

  async writeText(path: string, contents: string): Promise<void> {
    if (inTauri) return invoke("write_text_file", { path, contents });
    browserDownload(fileName(path), contents, MIME[extensionOf(path)] ?? "text/plain");
  },

  async writeBinary(path: string, bytes: Uint8Array): Promise<void> {
    if (inTauri) return invoke("write_binary_file", { path, base64: bytesToBase64(bytes) });
    browserDownload(fileName(path), bytes as BlobPart, MIME[extensionOf(path)] ?? "application/octet-stream");
  },

  async pathExists(path: string): Promise<boolean> {
    if (inTauri) return invoke<boolean>("path_exists", { path });
    return browserFiles.has(path);
  },

  /** Whether saving overwrites a real file (Tauri) or downloads a copy (browser). */
  savesInPlace: inTauri,

  // -- recent documents
  async recentList(): Promise<RecentDoc[]> {
    if (inTauri) return invoke<RecentDoc[]>("recent_list");
    return ls.get<RecentDoc[]>("pd.recent", []).map((d) => ({ ...d, exists: browserFiles.has(d.path) }));
  },
  async recentAdd(path: string): Promise<void> {
    if (inTauri) return invoke("recent_add", { path });
    const list = ls.get<RecentDoc[]>("pd.recent", []);
    const pinned = list.find((d) => d.path === path)?.pinned ?? false;
    const next = [{ path, name: fileName(path), openedMs: Date.now(), pinned, exists: true }, ...list.filter((d) => d.path !== path)];
    ls.set("pd.recent", next.slice(0, 40));
  },
  async recentRemove(path: string): Promise<void> {
    if (inTauri) return invoke("recent_remove", { path });
    ls.set("pd.recent", ls.get<RecentDoc[]>("pd.recent", []).filter((d) => d.path !== path));
  },
  async recentPin(path: string, pinned: boolean): Promise<void> {
    if (inTauri) return invoke("recent_pin", { path, pinned });
    ls.set("pd.recent", ls.get<RecentDoc[]>("pd.recent", []).map((d) => (d.path === path ? { ...d, pinned } : d)));
  },
  async recentClear(): Promise<void> {
    if (inTauri) return invoke("recent_clear");
    ls.set("pd.recent", ls.get<RecentDoc[]>("pd.recent", []).filter((d) => d.pinned));
  },

  // -- crash recovery
  async recoveryWrite(docId: string, payload: string): Promise<void> {
    if (inTauri) return invoke("recovery_write", { docId, payload });
    const all = ls.get<Record<string, RecoveryEntry>>("pd.recovery", {});
    all[docId] = { docId, payload, modifiedMs: Date.now() };
    ls.set("pd.recovery", all);
  },
  async recoveryList(): Promise<RecoveryEntry[]> {
    if (inTauri) return invoke<RecoveryEntry[]>("recovery_list");
    return Object.values(ls.get<Record<string, RecoveryEntry>>("pd.recovery", {})).sort((a, b) => b.modifiedMs - a.modifiedMs);
  },
  async recoveryClear(docId: string): Promise<void> {
    if (inTauri) return invoke("recovery_clear", { docId });
    const all = ls.get<Record<string, RecoveryEntry>>("pd.recovery", {});
    delete all[docId];
    ls.set("pd.recovery", all);
  },

  // -- revision snapshots
  async revisionCreate(docId: string, label: string, words: number, payload: string, maxKeep: number): Promise<RevisionInfo> {
    if (inTauri) return invoke<RevisionInfo>("revision_create", { docId, label, words, payload, maxKeep });
    const all = ls.get<Record<string, (RevisionInfo & { payload: string })[]>>("pd.revisions", {});
    const info: RevisionInfo = { id: `r${Date.now()}`, createdMs: Date.now(), label, words, size: payload.length };
    // Browser storage is small; keep fewer snapshots there.
    all[docId] = [{ ...info, payload }, ...(all[docId] ?? [])].slice(0, Math.min(maxKeep, 10));
    ls.set("pd.revisions", all);
    return info;
  },
  async revisionList(docId: string): Promise<RevisionInfo[]> {
    if (inTauri) return invoke<RevisionInfo[]>("revision_list", { docId });
    const all = ls.get<Record<string, (RevisionInfo & { payload: string })[]>>("pd.revisions", {});
    return (all[docId] ?? []).map(({ payload: _payload, ...info }) => info);
  },
  async revisionRead(docId: string, revisionId: string): Promise<string> {
    if (inTauri) return invoke<string>("revision_read", { docId, revisionId });
    const all = ls.get<Record<string, (RevisionInfo & { payload: string })[]>>("pd.revisions", {});
    const rev = all[docId]?.find((r) => r.id === revisionId);
    if (!rev) throw new Error("Revision not found");
    return rev.payload;
  },
  async revisionDelete(docId: string, revisionId: string): Promise<void> {
    if (inTauri) return invoke("revision_delete", { docId, revisionId });
    const all = ls.get<Record<string, (RevisionInfo & { payload: string })[]>>("pd.revisions", {});
    all[docId] = (all[docId] ?? []).filter((r) => r.id !== revisionId);
    ls.set("pd.revisions", all);
  },
  async revisionsMigrate(from: string, to: string): Promise<void> {
    if (inTauri) return invoke("revisions_migrate", { from, to });
    const all = ls.get<Record<string, (RevisionInfo & { payload: string })[]>>("pd.revisions", {});
    if (!all[from]) return;
    all[to] = [...all[from], ...(all[to] ?? [])].sort((a, b) => b.createdMs - a.createdMs);
    delete all[from];
    ls.set("pd.revisions", all);
  },

  // -- PDF & shell
  async exportPdf(path: string, options: PdfOptions): Promise<void> {
    return invoke("export_pdf", { path, options });
  },
  async openDataFolder(): Promise<void> {
    if (inTauri) return invoke("open_data_folder");
  },
  async revealInExplorer(path: string): Promise<void> {
    if (inTauri) return invoke("reveal_in_explorer", { path });
  },
  async setWindowTitle(title: string): Promise<void> {
    document.title = title;
    if (!inTauri) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().setTitle(title).catch(() => undefined);
  },
};

export const FORMAT_FILTERS: Record<DocFormat, FileFilter> = {
  pluto: { name: "PlutoDocs Document", extensions: ["pluto"] },
  docx: { name: "Word Document", extensions: ["docx"] },
  md: { name: "Markdown", extensions: ["md", "markdown"] },
  html: { name: "Web Page", extensions: ["html", "htm"] },
  txt: { name: "Plain Text", extensions: ["txt"] },
};
