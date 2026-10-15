import { clsx } from "clsx";
import {
  ChevronRight,
  FileCode2,
  FileDown,
  FileOutput,
  FilePlus2,
  FileText,
  FileType2,
  FolderOpen,
  FolderSearch,
  Printer,
  Save,
  SaveAll,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { exportDocument, newDocument, openDocument, printDocument, saveDocument, saveDocumentAs } from "@/lib/documents";
import { inTauri, platform } from "@/lib/platform";
import type { DocFormat, ExportFormat } from "@/lib/types";
import { isDirty, useApp } from "@/store/app";

function Action({
  icon: Icon,
  label,
  hint,
  onClick,
  trailing,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  onClick: () => void;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-hover active:bg-pressed"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent transition-transform group-hover:scale-105">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium">{label}</span>
        {hint && <span className="block truncate text-[11.5px] text-fg-3">{hint}</span>}
      </span>
      {trailing}
    </button>
  );
}

function SubList({ items }: { items: { label: string; ext: string; icon: LucideIcon; onClick: () => void }[] }) {
  return (
    <div className="mb-1 ml-[52px] mr-1 animate-fade-in border-l border-stroke pl-2">
      {items.map(({ label, ext, icon: Icon, onClick }) => (
        <button
          key={label}
          type="button"
          onClick={onClick}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] hover:bg-hover"
        >
          <Icon className="size-3.5 text-fg-3" />
          <span className="flex-1">{label}</span>
          <span className="text-[11px] text-fg-3">{ext}</span>
        </button>
      ))}
    </div>
  );
}

const SAVE_AS: { format: DocFormat; label: string; ext: string; icon: LucideIcon }[] = [
  { format: "pluto", label: "PlutoDocs Document", ext: ".pluto", icon: FileText },
  { format: "docx", label: "Word Document", ext: ".docx", icon: FileType2 },
  { format: "md", label: "Markdown", ext: ".md", icon: FileCode2 },
  { format: "html", label: "Web Page", ext: ".html", icon: FileCode2 },
  { format: "txt", label: "Plain Text", ext: ".txt", icon: FileText },
];

const EXPORTS: { format: ExportFormat; label: string; ext: string; icon: LucideIcon }[] = [
  { format: "pdf", label: "PDF", ext: ".pdf", icon: FileDown },
  { format: "html", label: "HTML", ext: ".html", icon: FileCode2 },
  { format: "md", label: "Markdown", ext: ".md", icon: FileCode2 },
  { format: "docx", label: "Word", ext: ".docx", icon: FileType2 },
];

function formatDate(ms: number) {
  return new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function FilesPanel() {
  const doc = useApp((s) => s.doc);
  const openSidebar = useApp((s) => s.openSidebar);
  const [expanded, setExpanded] = useState<"saveas" | "export" | null>(null);
  const toggle = (k: "saveas" | "export") => setExpanded((e) => (e === k ? null : k));
  const chevron = (k: "saveas" | "export") => (
    <ChevronRight className={clsx("size-4 text-fg-3 transition-transform", expanded === k && "rotate-90")} />
  );

  return (
    <div className="space-y-0.5">
      <Action icon={FilePlus2} label="New" hint="Blank document · Ctrl+N" onClick={() => void newDocument()} />
      <Action icon={FilePlus2} label="New from template" hint="Reports, letters, notes…" onClick={() => openSidebar("templates")} />
      <Action icon={FolderOpen} label="Open" hint=".pluto .docx .md .html .txt · Ctrl+O" onClick={() => void openDocument()} />
      <div className="mx-2 my-2 h-px bg-stroke" />
      <Action icon={Save} label="Save" hint={doc.path ? "Ctrl+S" : "Choose where to save · Ctrl+S"} onClick={() => void saveDocument()} />
      <Action icon={SaveAll} label="Save as" hint="Ctrl+Shift+S" onClick={() => toggle("saveas")} trailing={chevron("saveas")} />
      {expanded === "saveas" && (
        <SubList items={SAVE_AS.map((f) => ({ ...f, onClick: () => void saveDocumentAs(f.format) }))} />
      )}
      <Action icon={FileOutput} label="Export" hint="PDF, HTML, Markdown, Word" onClick={() => toggle("export")} trailing={chevron("export")} />
      {expanded === "export" && (
        <SubList items={EXPORTS.map((f) => ({ ...f, onClick: () => void exportDocument(f.format) }))} />
      )}
      <Action icon={Printer} label="Print" hint="Ctrl+P" onClick={() => void printDocument()} />

      <div className="mx-2 my-2 h-px bg-stroke" />
      <div className="rounded-lg border border-stroke bg-layer-alt p-3 text-[12px]">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-fg-3">Document info</div>
        <dl className="space-y-1.5">
          {[
            ["Name", doc.name],
            ["Format", doc.format === "pluto" ? "PlutoDocs (.pluto)" : `.${doc.format}`],
            ["Location", doc.path ?? "Not saved yet"],
            ["Created", formatDate(doc.createdAt)],
            ["Last saved", doc.lastSavedAt ? formatDate(doc.lastSavedAt) : "—"],
            ["Status", isDirty(doc) ? "Unsaved changes" : "Up to date"],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="w-[70px] shrink-0 text-fg-3">{k}</dt>
              <dd className="min-w-0 flex-1 break-words text-fg-2">{v}</dd>
            </div>
          ))}
        </dl>
        {inTauri && doc.path && (
          <button
            type="button"
            onClick={() => void platform.revealInExplorer(doc.path!)}
            className="mt-2.5 flex items-center gap-1.5 text-[12px] font-medium text-accent hover:underline"
          >
            <FolderSearch className="size-3.5" /> Show in File Explorer
          </button>
        )}
      </div>
    </div>
  );
}
