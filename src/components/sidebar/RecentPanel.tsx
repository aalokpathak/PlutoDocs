import { clsx } from "clsx";
import { FileCode2, FileText, FileType2, FolderOpen, Pin, PinOff, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { openDocument } from "@/lib/documents";
import { extensionOf, platform, type RecentDoc } from "@/lib/platform";
import { useApp } from "@/store/app";
import { relativeTime } from "../StatusBar";

export function DocIcon({ path, className }: { path: string; className?: string }) {
  const ext = extensionOf(path);
  const color =
    ext === "docx" ? "text-[#2b6cd8]" : ext === "pluto" ? "text-accent" : ext === "md" || ext === "markdown" ? "text-[#0f9d76]" : ext.startsWith("htm") ? "text-[#e2673a]" : "text-fg-3";
  const Icon = ext === "docx" ? FileType2 : ext === "md" || ext.startsWith("htm") ? FileCode2 : FileText;
  return <Icon className={clsx("size-[18px] shrink-0", color, className)} />;
}

function folderOf(path: string) {
  const parts = path.split(/[\\/]/);
  parts.pop();
  return parts.join("\\") || path;
}

function RecentItem({ item }: { item: RecentDoc }) {
  const refreshRecent = useApp((s) => s.refreshRecent);
  const current = useApp((s) => s.doc.path === item.path);
  const act = async (fn: () => Promise<void>) => {
    await fn().catch(() => undefined);
    await refreshRecent();
  };
  return (
    <div
      className={clsx(
        "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-hover",
        current && "bg-accent-soft",
        !item.exists && "opacity-50",
      )}
    >
      <button
        type="button"
        className="absolute inset-0 rounded-lg"
        aria-label={`Open ${item.name}`}
        title={item.exists ? item.path : `${item.path} (not found)`}
        onClick={() => void openDocument(item.path)}
      />
      <DocIcon path={item.path} />
      <div className="pointer-events-none min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium">{item.name}</div>
        <div className="truncate text-[11px] text-fg-3">
          {item.exists ? `${relativeTime(item.openedMs)} · ${folderOf(item.path)}` : "File not found"}
        </div>
      </div>
      <div className="relative flex opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          title={item.pinned ? "Unpin" : "Pin to top"}
          onClick={() => void act(() => platform.recentPin(item.path, !item.pinned))}
          className="flex size-6 items-center justify-center rounded text-fg-3 hover:bg-hover hover:text-fg"
        >
          {item.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
        </button>
        <button
          type="button"
          title="Remove from list"
          onClick={() => void act(() => platform.recentRemove(item.path))}
          className="flex size-6 items-center justify-center rounded text-fg-3 hover:bg-hover hover:text-fg"
        >
          <X className="size-3.5" />
        </button>
      </div>
      {item.pinned && <Pin className="absolute right-2 top-2 size-3 text-accent group-hover:hidden" />}
    </div>
  );
}

export function RecentPanel() {
  const recent = useApp((s) => s.recent);
  const refreshRecent = useApp((s) => s.refreshRecent);
  const [query, setQuery] = useState("");

  useEffect(() => {
    void refreshRecent();
  }, [refreshRecent]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? recent.filter((d) => d.path.toLowerCase().includes(q)) : recent;
  }, [recent, query]);
  const pinned = filtered.filter((d) => d.pinned);
  const others = filtered.filter((d) => !d.pinned);

  return (
    <div>
      <div className="relative mb-2 px-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-3" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search recent"
          className="h-8 w-full rounded-md border border-stroke bg-layer-solid pl-8 pr-2 text-[12.5px] outline-none focus:border-accent"
        />
      </div>
      {!recent.length && (
        <div className="flex flex-col items-center px-6 py-10 text-center text-[12.5px] text-fg-3">
          <FolderOpen className="mb-3 size-9 text-fg-3/60" strokeWidth={1.4} />
          Documents you open or save will appear here.
          <button type="button" onClick={() => void openDocument()} className="mt-3 font-medium text-accent hover:underline">
            Open a document…
          </button>
        </div>
      )}
      {pinned.length > 0 && (
        <>
          <div className="px-2.5 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-fg-3">Pinned</div>
          {pinned.map((d) => (
            <RecentItem key={d.path} item={d} />
          ))}
        </>
      )}
      {others.length > 0 && (
        <>
          {pinned.length > 0 && <div className="px-2.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-fg-3">Recent</div>}
          {others.map((d) => (
            <RecentItem key={d.path} item={d} />
          ))}
        </>
      )}
      {others.length > 0 && !query && (
        <button
          type="button"
          onClick={() => void platform.recentClear().then(refreshRecent)}
          className="mx-2.5 mt-3 text-[12px] text-fg-3 hover:text-fg hover:underline"
        >
          Clear unpinned items
        </button>
      )}
    </div>
  );
}
