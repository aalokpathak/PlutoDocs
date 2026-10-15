import type { JSONContent } from "@tiptap/react";

export type DocFormat = "pluto" | "docx" | "md" | "html" | "txt";
export type ExportFormat = "pdf" | "html" | "md" | "docx" | "txt";

export type PageSize = "a4" | "letter" | "legal" | "a5";
export type Orientation = "portrait" | "landscape";
export type MarginPreset = "normal" | "narrow" | "moderate" | "wide";

/** Per-document layout, stored inside .pluto files. */
export interface PageSetup {
  size: PageSize;
  orientation: Orientation;
  margins: MarginPreset;
  fontFamily: string;
  /** Base font size in points. */
  fontSize: number;
}

/** On-disk shape of a .pluto document. */
export interface PlutoFile {
  format: "pluto";
  version: 1;
  app: string;
  meta: {
    title: string;
    createdAt: number;
    modifiedAt: number;
    words: number;
  };
  page: PageSetup;
  content: JSONContent;
}

/** What the autosave engine stores for crash recovery. */
export interface RecoveryPayload extends PlutoFile {
  recovery: {
    docId: string;
    path: string | null;
    name: string;
    docFormat: DocFormat;
  };
}

export type Theme = "light" | "dark" | "system";

export interface Settings {
  theme: Theme;
  accent: string;
  /** Save to the open file automatically shortly after edits stop. */
  autoSave: boolean;
  autoSaveDelaySec: number;
  /** Minutes between automatic revision snapshots. */
  snapshotMinutes: number;
  maxSnapshots: number;
  spellcheck: boolean;
  showPageGuides: boolean;
  darkPaper: boolean;
  defaultPage: PageSetup;
}
