import {
  Expand,
  Focus,
  ListTree,
  Maximize2,
  MoonStar,
  PanelLeft,
  ScanLine,
  SpellCheck,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { pagePixels } from "@/lib/page";
import { inTauri } from "@/lib/platform";
import { useApp } from "@/store/app";
import { ToolButton } from "../ui";
import { Group } from "./shared";

export const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];

export function zoomStep(dir: 1 | -1) {
  const { zoom, setZoom } = useApp.getState();
  const next = dir > 0 ? ZOOM_STEPS.find((z) => z > zoom + 0.001) : [...ZOOM_STEPS].reverse().find((z) => z < zoom - 0.001);
  setZoom(next ?? zoom);
}

export function fitPageWidth() {
  const { doc, setZoom } = useApp.getState();
  const scroller = document.getElementById("canvas-scroll");
  if (!scroller) return;
  setZoom((scroller.clientWidth - 64) / pagePixels(doc.page).width);
}

export async function toggleFullscreen() {
  if (inTauri) {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();
    await win.setFullscreen(!(await win.isFullscreen()));
  } else if (document.fullscreenElement) {
    await document.exitFullscreen();
  } else {
    await document.documentElement.requestFullscreen();
  }
}

export function ViewTab() {
  const zoom = useApp((s) => s.zoom);
  const setZoom = useApp((s) => s.setZoom);
  const settings = useApp((s) => s.settings);
  const updateSettings = useApp((s) => s.updateSettings);
  const sidebarOpen = useApp((s) => s.sidebarOpen);
  const sidebarPanel = useApp((s) => s.sidebarPanel);
  const toggleSidebar = useApp((s) => s.toggleSidebar);
  const openSidebar = useApp((s) => s.openSidebar);
  const setFocusMode = useApp((s) => s.setFocusMode);

  return (
    <>
      <Group label="Zoom">
        <ToolButton label="Zoom out" shortcut="Ctrl+-" onClick={() => zoomStep(-1)}>
          <ZoomOut className="size-4" />
        </ToolButton>
        <span className="tabular w-11 text-center text-[12.5px] text-fg-2">{Math.round(zoom * 100)}%</span>
        <ToolButton label="Zoom in" shortcut="Ctrl+=" onClick={() => zoomStep(1)}>
          <ZoomIn className="size-4" />
        </ToolButton>
        <ToolButton label="100%" shortcut="Ctrl+0" wide active={zoom === 1} onClick={() => setZoom(1)}>
          100%
        </ToolButton>
        <ToolButton label="Fit page width" wide onClick={fitPageWidth}>
          <Expand className="size-4" /> Page width
        </ToolButton>
      </Group>
      <Group label="Show">
        <ToolButton label="Sidebar" shortcut="Ctrl+\" wide active={sidebarOpen} onClick={toggleSidebar}>
          <PanelLeft className="size-4" /> Sidebar
        </ToolButton>
        <ToolButton
          label="Navigation outline"
          wide
          active={sidebarOpen && sidebarPanel === "outline"}
          onClick={() => openSidebar("outline")}
        >
          <ListTree className="size-4" /> Outline
        </ToolButton>
        <ToolButton
          label="Page boundaries"
          wide
          active={settings.showPageGuides}
          onClick={() => updateSettings({ showPageGuides: !settings.showPageGuides })}
        >
          <ScanLine className="size-4" /> Page guides
        </ToolButton>
        <ToolButton label="Spell check" wide active={settings.spellcheck} onClick={() => updateSettings({ spellcheck: !settings.spellcheck })}>
          <SpellCheck className="size-4" /> Spelling
        </ToolButton>
        <ToolButton
          label="Dark page in dark theme"
          wide
          active={settings.darkPaper}
          onClick={() => updateSettings({ darkPaper: !settings.darkPaper })}
        >
          <MoonStar className="size-4" /> Dark page
        </ToolButton>
      </Group>
      <Group label="Immersive" last>
        <ToolButton label="Focus mode" shortcut="F11" wide onClick={() => setFocusMode(true)}>
          <Focus className="size-4" /> Focus
        </ToolButton>
        <ToolButton label="Full screen" wide onClick={() => void toggleFullscreen()}>
          <Maximize2 className="size-4" /> Full screen
        </ToolButton>
      </Group>
    </>
  );
}
