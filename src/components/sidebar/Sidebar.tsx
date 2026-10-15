import type { Editor } from "@tiptap/react";
import { clsx } from "clsx";
import { Clock, FolderOpen, History, LayoutTemplate, ListTree, PanelLeftClose, Settings, type LucideIcon } from "lucide-react";
import { useApp, type SidebarPanel } from "@/store/app";
import { FilesPanel } from "./FilesPanel";
import { HistoryPanel } from "./HistoryPanel";
import { OutlinePanel } from "./OutlinePanel";
import { RecentPanel } from "./RecentPanel";
import { SettingsPanel } from "./SettingsPanel";
import { TemplatesPanel } from "./TemplatesPanel";

const ITEMS: { id: SidebarPanel; label: string; icon: LucideIcon }[] = [
  { id: "files", label: "File", icon: FolderOpen },
  { id: "recent", label: "Recent", icon: Clock },
  { id: "templates", label: "Templates", icon: LayoutTemplate },
  { id: "outline", label: "Outline", icon: ListTree },
  { id: "history", label: "Version history", icon: History },
];

const TITLES: Record<SidebarPanel, string> = {
  files: "File",
  recent: "Recent documents",
  templates: "Templates",
  outline: "Outline",
  history: "Version history",
  settings: "Settings",
};

function RailButton({ id, label, icon: Icon }: { id: SidebarPanel; label: string; icon: LucideIcon }) {
  const active = useApp((s) => s.sidebarOpen && s.sidebarPanel === id);
  const openSidebar = useApp((s) => s.openSidebar);
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={() => openSidebar(id)}
      className={clsx(
        "relative flex size-10 items-center justify-center rounded-lg transition-colors",
        active ? "bg-layer-solid text-accent shadow-card" : "text-fg-2 hover:bg-hover hover:text-fg",
      )}
    >
      {active && <span className="absolute -left-1.5 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-accent" />}
      <Icon className="size-[18px]" />
    </button>
  );
}

export function Sidebar({ editor }: { editor: Editor }) {
  const open = useApp((s) => s.sidebarOpen);
  const panel = useApp((s) => s.sidebarPanel);
  const toggleSidebar = useApp((s) => s.toggleSidebar);

  return (
    <aside className="flex shrink-0">
      <nav className="flex w-[52px] flex-col items-center gap-1 bg-chrome py-2" aria-label="Sidebar">
        {ITEMS.map((item) => (
          <RailButton key={item.id} {...item} />
        ))}
        <div className="flex-1" />
        <RailButton id="settings" label="Settings" icon={Settings} />
      </nav>
      <div
        className={clsx(
          "overflow-hidden bg-chrome transition-[width] duration-200 ease-out",
          open ? "w-[292px]" : "w-0",
        )}
      >
        <div className="glass mb-2 mr-2 flex h-[calc(100%-0.5rem)] w-[284px] flex-col overflow-hidden rounded-xl">
          <div className="flex h-12 shrink-0 items-center justify-between pl-4 pr-2">
            <h2 className="font-display text-[15px] font-semibold">{TITLES[panel]}</h2>
            <button
              type="button"
              title="Collapse sidebar (Ctrl+\)"
              onClick={toggleSidebar}
              className="flex size-8 items-center justify-center rounded-md text-fg-3 hover:bg-hover hover:text-fg"
            >
              <PanelLeftClose className="size-4" />
            </button>
          </div>
          <div key={panel} className="min-h-0 flex-1 animate-slide-in overflow-y-auto px-2 pb-3">
            {panel === "files" && <FilesPanel />}
            {panel === "recent" && <RecentPanel />}
            {panel === "templates" && <TemplatesPanel />}
            {panel === "outline" && <OutlinePanel editor={editor} />}
            {panel === "history" && <HistoryPanel />}
            {panel === "settings" && <SettingsPanel />}
          </div>
        </div>
      </div>
    </aside>
  );
}
