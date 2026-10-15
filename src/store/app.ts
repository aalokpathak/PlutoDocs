import { create } from "zustand";
import { DEFAULT_PAGE } from "@/lib/page";
import { inTauri, platform, type AppInfo, type RecentDoc, type RecoveryEntry } from "@/lib/platform";
import type { DocFormat, PageSetup, Settings, Theme } from "@/lib/types";

export type SidebarPanel = "files" | "recent" | "templates" | "outline" | "history" | "settings";
export type RibbonTab = "home" | "insert" | "layout" | "view" | "table";

export interface Toast {
  id: number;
  tone: "success" | "error" | "info";
  title: string;
  body?: string;
}

export interface ConfirmOptions {
  title: string;
  body: string;
  /** Buttons in display order; the first is the primary action. */
  actions: { id: string; label: string; tone?: "primary" | "danger" | "default" }[];
}

export type Dialog =
  | { kind: "link" }
  | { kind: "image" }
  | { kind: "symbols" }
  | { kind: "about" }
  | { kind: "recovery"; entries: RecoveryEntry[] }
  | { kind: "confirm"; options: ConfirmOptions; resolve: (id: string) => void };

export interface DocState {
  /** Key for autosave and revision history; derived from the path once saved. */
  docId: string;
  path: string | null;
  name: string;
  format: DocFormat;
  page: PageSetup;
  createdAt: number;
  /** Incremented on every content change. */
  changeCount: number;
  savedChangeCount: number;
  lastSavedAt: number | null;
  lastBackupAt: number | null;
  saving: boolean;
  saveError: string | null;
}

const ACCENTS: Record<string, string> = {
  indigo: "99 102 241",
  blue: "37 99 235",
  teal: "13 148 136",
  violet: "139 92 246",
  rose: "225 29 72",
  amber: "217 119 6",
};
export const ACCENT_NAMES = Object.keys(ACCENTS);
export const accentRgb = (name: string) => ACCENTS[name] ?? ACCENTS.indigo;

const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  accent: "indigo",
  autoSave: true,
  autoSaveDelaySec: 3,
  snapshotMinutes: 5,
  maxSnapshots: 50,
  spellcheck: true,
  showPageGuides: true,
  darkPaper: false,
  defaultPage: DEFAULT_PAGE,
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem("pd.settings");
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed, defaultPage: { ...DEFAULT_PAGE, ...parsed.defaultPage } };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: Settings) {
  try {
    localStorage.setItem("pd.settings", JSON.stringify(settings));
  } catch {
    /* storage unavailable */
  }
}

const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

export function resolveDark(theme: Theme): boolean {
  return theme === "dark" || (theme === "system" && darkQuery.matches);
}

async function applyAppearance(settings: Settings) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolveDark(settings.theme));
  root.classList.toggle("paper-dark", settings.darkPaper);
  root.style.setProperty("--pd-accent-rgb", accentRgb(settings.accent));
  if (inTauri) {
    // Keeps the Mica backdrop tint in sync with the chosen theme.
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow()
      .setTheme(settings.theme === "system" ? null : settings.theme)
      .catch(() => undefined);
  }
}

let untitledCounter = 0;
export function newUntitledDoc(page: PageSetup): DocState {
  untitledCounter += 1;
  return {
    docId: `u-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    path: null,
    name: `Document${untitledCounter}`,
    format: "pluto",
    page,
    createdAt: Date.now(),
    changeCount: 0,
    savedChangeCount: 0,
    lastSavedAt: null,
    lastBackupAt: null,
    saving: false,
    saveError: null,
  };
}

interface AppState {
  appInfo: AppInfo | null;
  settings: Settings;
  doc: DocState;

  sidebarOpen: boolean;
  sidebarPanel: SidebarPanel;
  ribbonTab: RibbonTab;
  zoom: number;
  focusMode: boolean;
  find: { open: boolean; replace: boolean };
  dialog: Dialog | null;
  toasts: Toast[];
  recent: RecentDoc[];
  /** Bumped when revision history changes so the History panel reloads. */
  historyVersion: number;
  pageCount: number;

  init: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => void;
  setDoc: (patch: Partial<DocState>) => void;
  replaceDoc: (doc: DocState) => void;
  markChanged: () => void;
  setPage: (patch: Partial<PageSetup>) => void;

  openSidebar: (panel: SidebarPanel) => void;
  toggleSidebar: () => void;
  setRibbonTab: (tab: RibbonTab) => void;
  setZoom: (zoom: number) => void;
  setFocusMode: (on: boolean) => void;
  openFind: (replace: boolean) => void;
  closeFind: () => void;

  openDialog: (dialog: Dialog) => void;
  closeDialog: () => void;
  confirm: (options: ConfirmOptions) => Promise<string>;

  toast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;
  refreshRecent: () => Promise<void>;
  bumpHistory: () => void;
  setPageCount: (n: number) => void;
}

let toastId = 0;
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 4;

export const useApp = create<AppState>((set, get) => {
  const settings = loadSettings();
  void applyAppearance(settings);

  return {
    appInfo: null,
    settings,
    doc: newUntitledDoc(settings.defaultPage),

    sidebarOpen: true,
    sidebarPanel: "files",
    ribbonTab: "home",
    zoom: 1,
    focusMode: false,
    find: { open: false, replace: false },
    dialog: null,
    toasts: [],
    recent: [],
    historyVersion: 0,
    pageCount: 1,

    init: async () => {
      darkQuery.addEventListener("change", () => void applyAppearance(get().settings));
      const appInfo = await platform.appInfo().catch(() => null);
      set({ appInfo });
      if (appInfo?.mica) document.documentElement.classList.add("mica");
      await get().refreshRecent();
    },

    updateSettings: (patch) => {
      const next = { ...get().settings, ...patch };
      set({ settings: next });
      saveSettings(next);
      void applyAppearance(next);
    },

    setDoc: (patch) => set((s) => ({ doc: { ...s.doc, ...patch } })),
    replaceDoc: (doc) => set({ doc }),
    markChanged: () => set((s) => ({ doc: { ...s.doc, changeCount: s.doc.changeCount + 1 } })),
    setPage: (patch) =>
      set((s) => ({ doc: { ...s.doc, page: { ...s.doc.page, ...patch }, changeCount: s.doc.changeCount + 1 } })),

    openSidebar: (panel) =>
      set((s) => ({
        sidebarPanel: panel,
        // Clicking the active panel's icon again collapses the sidebar.
        sidebarOpen: s.sidebarOpen && s.sidebarPanel === panel ? false : true,
      })),
    toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    setRibbonTab: (ribbonTab) => set({ ribbonTab }),
    setZoom: (zoom) => set({ zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(zoom * 100) / 100)) }),
    setFocusMode: (focusMode) => set({ focusMode }),
    openFind: (replace) => set({ find: { open: true, replace } }),
    closeFind: () => set({ find: { open: false, replace: false } }),

    openDialog: (dialog) => set({ dialog }),
    closeDialog: () => set({ dialog: null }),
    confirm: (options) =>
      new Promise<string>((resolve) => {
        set({
          dialog: {
            kind: "confirm",
            options,
            resolve: (id) => {
              set({ dialog: null });
              resolve(id);
            },
          },
        });
      }),

    toast: (toast) => {
      const id = ++toastId;
      set((s) => ({ toasts: [...s.toasts.slice(-3), { ...toast, id }] }));
      setTimeout(() => get().dismissToast(id), toast.tone === "error" ? 7000 : 3800);
    },
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

    refreshRecent: async () => {
      const recent = await platform.recentList().catch(() => []);
      set({ recent });
    },
    bumpHistory: () => set((s) => ({ historyVersion: s.historyVersion + 1 })),
    setPageCount: (pageCount) => set({ pageCount }),
  };
});

export const isDirty = (doc: DocState) => doc.changeCount !== doc.savedChangeCount;
