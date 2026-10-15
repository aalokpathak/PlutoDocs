import { useEditorState, type Editor } from "@tiptap/react";
import { clsx } from "clsx";
import { useEffect } from "react";
import { useApp, type RibbonTab } from "@/store/app";
import { HomeTab } from "./HomeTab";
import { InsertTab } from "./InsertTab";
import { LayoutTab } from "./LayoutTab";
import { TableTab } from "./TableTab";
import { ViewTab } from "./ViewTab";

const TABS: { id: RibbonTab; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "insert", label: "Insert" },
  { id: "layout", label: "Layout" },
  { id: "view", label: "View" },
];

export function Ribbon({ editor }: { editor: Editor }) {
  const tab = useApp((s) => s.ribbonTab);
  const setTab = useApp((s) => s.setRibbonTab);
  const openSidebar = useApp((s) => s.openSidebar);
  const inTable = useEditorState({ editor, selector: ({ editor: e }) => e.isActive("table") });

  // Leaving the table hides its contextual tab.
  useEffect(() => {
    if (!inTable && tab === "table") setTab("home");
  }, [inTable, tab, setTab]);

  const tabClass = (active: boolean) =>
    clsx(
      "relative h-8 rounded-md px-3 text-[12.5px] transition-colors",
      active ? "font-semibold text-fg" : "text-fg-2 hover:bg-hover hover:text-fg",
    );

  return (
    <div className="shrink-0 bg-chrome px-2 pb-2">
      <div className="flex items-center gap-0.5 px-1 pb-1" role="tablist">
        <button
          type="button"
          onClick={() => openSidebar("files")}
          className="mr-1 h-7 rounded-md bg-accent px-3.5 text-[12.5px] font-medium text-accent-fg shadow-sm transition-colors hover:bg-accent-hover"
        >
          File
        </button>
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={tabClass(tab === t.id)}>
            {t.label}
            {tab === t.id && <span className="absolute inset-x-3 -bottom-px h-[3px] rounded-full bg-accent" />}
          </button>
        ))}
        {inTable && (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "table"}
            onClick={() => setTab("table")}
            className={clsx(tabClass(tab === "table"), "ml-2 text-accent")}
          >
            Table Design
            {tab === "table" && <span className="absolute inset-x-3 -bottom-px h-[3px] rounded-full bg-accent" />}
          </button>
        )}
      </div>
      <div
        key={tab}
        role="tabpanel"
        className="no-scrollbar glass flex h-11 animate-fade-in items-center overflow-x-auto rounded-lg px-1"
      >
        {tab === "home" && <HomeTab editor={editor} />}
        {tab === "insert" && <InsertTab editor={editor} />}
        {tab === "layout" && <LayoutTab />}
        {tab === "view" && <ViewTab />}
        {tab === "table" && inTable && <TableTab editor={editor} />}
      </div>
    </div>
  );
}
