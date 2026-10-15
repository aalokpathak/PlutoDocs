import { clsx } from "clsx";
import { Camera, History, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { createSnapshot, restoreRevision } from "@/lib/documents";
import { errorMessage, platform, type RevisionInfo } from "@/lib/platform";
import { useApp } from "@/store/app";
import { Button } from "../ui";

function groupLabel(ms: number) {
  const d = new Date(ms);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export function HistoryPanel() {
  const docId = useApp((s) => s.doc.docId);
  const version = useApp((s) => s.historyVersion);
  const settings = useApp((s) => s.settings);
  const toast = useApp((s) => s.toast);
  const confirm = useApp((s) => s.confirm);
  const [revisions, setRevisions] = useState<RevisionInfo[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    platform
      .revisionList(docId)
      .then((r) => !cancelled && setRevisions(r))
      .catch(() => !cancelled && setRevisions([]));
    return () => {
      cancelled = true;
    };
  }, [docId, version]);

  const restore = async (rev: RevisionInfo) => {
    const ok = await confirm({
      title: "Restore this version?",
      body: `The document will be replaced with the version from ${new Date(rev.createdMs).toLocaleString()}. Your current content is kept as a new version first.`,
      actions: [
        { id: "restore", label: "Restore", tone: "primary" },
        { id: "cancel", label: "Cancel" },
      ],
    });
    if (ok !== "restore") return;
    try {
      await restoreRevision(rev.id);
    } catch (e) {
      toast({ tone: "error", title: "Restore failed", body: errorMessage(e) });
    }
  };

  const remove = async (rev: RevisionInfo) => {
    await platform.revisionDelete(docId, rev.id).catch(() => undefined);
    setRevisions((r) => r?.filter((x) => x.id !== rev.id) ?? null);
  };

  let lastGroup = "";
  return (
    <div className="px-1">
      <div className="mb-3 rounded-lg border border-stroke bg-layer-alt p-3 text-[12px] text-fg-2">
        <div className="mb-1 flex items-center gap-1.5 font-medium text-fg">
          <ShieldCheck className="size-4 text-success" /> Your work is protected
        </div>
        A recovery copy is written seconds after each edit, and a version is saved every {settings.snapshotMinutes} minutes while you
        work and whenever you save.
      </div>
      <Button tone="default" size="sm" className="mb-3 w-full" onClick={() => void createSnapshot("Manual snapshot", true)}>
        <Camera className="size-3.5" /> Save a version now
      </Button>
      {revisions && !revisions.length && (
        <div className="flex flex-col items-center px-4 py-8 text-center text-[12.5px] text-fg-3">
          <History className="mb-3 size-9 text-fg-3/60" strokeWidth={1.4} />
          No versions yet. Versions appear here as you edit and save.
        </div>
      )}
      {revisions?.map((rev, i) => {
        const group = groupLabel(rev.createdMs);
        const header = group !== lastGroup;
        lastGroup = group;
        return (
          <div key={rev.id}>
            {header && <div className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-fg-3">{group}</div>}
            <div className="group relative flex gap-3 rounded-lg px-2 py-2 hover:bg-hover">
              <div className="flex flex-col items-center pt-1">
                <span className={clsx("size-2.5 rounded-full border-2", i === 0 ? "border-accent bg-accent" : "border-fg-3")} />
                {i < revisions.length - 1 && <span className="mt-1 w-px flex-1 bg-stroke-strong" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium">
                  {new Date(rev.createdMs).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                </div>
                <div className="text-[11.5px] text-fg-3">
                  {rev.label} · {rev.words.toLocaleString()} words
                </div>
              </div>
              <div className="flex items-start gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  title="Restore this version"
                  onClick={() => void restore(rev)}
                  className="flex size-7 items-center justify-center rounded-md text-fg-2 hover:bg-hover hover:text-accent"
                >
                  <RotateCcw className="size-3.5" />
                </button>
                <button
                  type="button"
                  title="Delete this version"
                  onClick={() => void remove(rev)}
                  className="flex size-7 items-center justify-center rounded-md text-fg-2 hover:bg-hover hover:text-danger"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
