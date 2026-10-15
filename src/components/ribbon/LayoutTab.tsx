import { clsx } from "clsx";
import { FileText, RectangleHorizontal, RectangleVertical, Ruler, Type } from "lucide-react";
import { MARGINS, PAGE_SIZES } from "@/lib/page";
import type { MarginPreset, PageSize } from "@/lib/types";
import { useApp } from "@/store/app";
import { DropdownButton, MenuItem, MenuLabel, ToolButton } from "../ui";
import { FONT_FAMILIES, FONT_SIZES, Group } from "./shared";

function MarginPreview({ preset }: { preset: MarginPreset }) {
  const [t, r, b, l] = MARGINS[preset].value;
  const s = 5;
  return (
    <span className="relative block h-[34px] w-[26px] shrink-0 rounded-[2px] border border-stroke-strong bg-layer-solid">
      <span className="absolute border border-dashed border-accent/70" style={{ top: t * s, right: r * s, bottom: b * s, left: l * s }} />
    </span>
  );
}

export function LayoutTab() {
  const page = useApp((s) => s.doc.page);
  const setPage = useApp((s) => s.setPage);

  return (
    <>
      <Group label="Page setup">
        <DropdownButton label="Margins" icon={<Ruler className="size-4" />} text="Margins">
          {(close) => (
            <div className="w-[230px]">
              {(Object.keys(MARGINS) as MarginPreset[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setPage({ margins: m });
                    close();
                  }}
                  className={clsx("flex w-full items-center gap-3 rounded-md px-2.5 py-1.5 text-left hover:bg-hover", page.margins === m && "bg-accent-soft")}
                >
                  <MarginPreview preset={m} />
                  <span>
                    <span className="block text-[13px] font-medium">{MARGINS[m].label}</span>
                    <span className="block text-[11.5px] text-fg-3">{MARGINS[m].detail}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </DropdownButton>
        <ToolButton label="Portrait" wide active={page.orientation === "portrait"} onClick={() => setPage({ orientation: "portrait" })}>
          <RectangleVertical className="size-4" /> Portrait
        </ToolButton>
        <ToolButton label="Landscape" wide active={page.orientation === "landscape"} onClick={() => setPage({ orientation: "landscape" })}>
          <RectangleHorizontal className="size-4" /> Landscape
        </ToolButton>
        <DropdownButton label="Page size" icon={<FileText className="size-4" />} text={PAGE_SIZES[page.size].label}>
          {(close) => (
            <div className="w-[200px]">
              {(Object.keys(PAGE_SIZES) as PageSize[]).map((s) => (
                <MenuItem
                  key={s}
                  checked={page.size === s}
                  hint={PAGE_SIZES[s].detail}
                  onSelect={() => {
                    setPage({ size: s });
                    close();
                  }}
                >
                  {PAGE_SIZES[s].label}
                </MenuItem>
              ))}
            </div>
          )}
        </DropdownButton>
      </Group>
      <Group label="Document font" last>
        <DropdownButton
          label="Body font for this document"
          icon={<Type className="size-4" />}
          text={<span style={{ fontFamily: page.fontFamily }}>{page.fontFamily}</span>}
          panelClassName="max-h-[360px] overflow-y-auto"
        >
          {(close) => (
            <div className="w-[210px]">
              <MenuLabel>Body font</MenuLabel>
              {FONT_FAMILIES.map((f) => (
                <MenuItem
                  key={f}
                  checked={page.fontFamily === f}
                  onSelect={() => {
                    setPage({ fontFamily: f });
                    close();
                  }}
                >
                  <span style={{ fontFamily: f }}>{f}</span>
                </MenuItem>
              ))}
            </div>
          )}
        </DropdownButton>
        <DropdownButton label="Body font size for this document" text={`${page.fontSize} pt`} panelClassName="max-h-[320px] overflow-y-auto">
          {(close) => (
            <div className="w-[100px]">
              {FONT_SIZES.filter((s) => s >= 9 && s <= 24).map((s) => (
                <MenuItem
                  key={s}
                  checked={page.fontSize === s}
                  onSelect={() => {
                    setPage({ fontSize: s });
                    close();
                  }}
                >
                  {s} pt
                </MenuItem>
              ))}
            </div>
          )}
        </DropdownButton>
      </Group>
    </>
  );
}
