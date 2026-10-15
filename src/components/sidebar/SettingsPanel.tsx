import { clsx } from "clsx";
import { Check, FolderCog, Info, Monitor, Moon, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { MARGINS, PAGE_SIZES } from "@/lib/page";
import { inTauri, platform } from "@/lib/platform";
import type { MarginPreset, PageSize, Theme } from "@/lib/types";
import { ACCENT_NAMES, accentRgb, useApp } from "@/store/app";
import { FONT_FAMILIES } from "../ribbon/shared";
import { Segmented, Switch } from "../ui";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-4">
      <div className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-3">{title}</div>
      <div className="divide-y divide-stroke rounded-lg border border-stroke bg-layer-alt">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-medium">{label}</div>
        {hint && <div className="text-[11px] leading-snug text-fg-3">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function Select<T extends string | number>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <select
      value={String(value)}
      onChange={(e) => {
        const raw = e.target.value;
        onChange((typeof value === "number" ? Number(raw) : raw) as T);
      }}
      className="h-7 max-w-[118px] rounded-md border border-stroke bg-layer-solid px-1.5 text-[12px] text-fg outline-none focus:border-accent"
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function SettingsPanel() {
  const s = useApp((st) => st.settings);
  const update = useApp((st) => st.updateSettings);
  const appInfo = useApp((st) => st.appInfo);
  const openDialog = useApp((st) => st.openDialog);
  const setDefaultPage = (patch: Partial<typeof s.defaultPage>) => update({ defaultPage: { ...s.defaultPage, ...patch } });

  return (
    <div className="px-1">
      <Section title="Appearance">
        <div className="px-3 py-2.5">
          <div className="mb-2 text-[12.5px] font-medium">Theme</div>
          <Segmented<Theme>
            value={s.theme}
            onChange={(theme) => update({ theme })}
            options={[
              { value: "light", label: <><Sun className="size-3.5" /> Light</> },
              { value: "dark", label: <><Moon className="size-3.5" /> Dark</> },
              { value: "system", label: <><Monitor className="size-3.5" /> System</> },
            ]}
          />
        </div>
        <div className="px-3 py-2.5">
          <div className="mb-2 text-[12.5px] font-medium">Accent colour</div>
          <div className="flex gap-2">
            {ACCENT_NAMES.map((name) => (
              <button
                key={name}
                type="button"
                title={name[0].toUpperCase() + name.slice(1)}
                onClick={() => update({ accent: name })}
                className="flex size-7 items-center justify-center rounded-full ring-offset-2 ring-offset-[var(--pd-layer-solid)] transition-transform hover:scale-110"
                style={{ backgroundColor: `rgb(${accentRgb(name)})`, boxShadow: s.accent === name ? `0 0 0 2px rgb(${accentRgb(name)} / 0.45)` : undefined }}
              >
                {s.accent === name && <Check className="size-3.5 text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>
        <Row label="Dark page" hint="Use a dark sheet in dark theme">
          <Switch checked={s.darkPaper} onChange={(v) => update({ darkPaper: v })} label="Dark page" />
        </Row>
        <Row label="Page guides" hint="Show where pages break">
          <Switch checked={s.showPageGuides} onChange={(v) => update({ showPageGuides: v })} label="Page guides" />
        </Row>
      </Section>

      <Section title="Saving & recovery">
        <Row label="AutoSave" hint="Save to the open file a few seconds after you stop typing">
          <Switch checked={s.autoSave} onChange={(v) => update({ autoSave: v })} label="AutoSave" />
        </Row>
        <Row label="AutoSave delay">
          <Select
            value={s.autoSaveDelaySec}
            onChange={(v) => update({ autoSaveDelaySec: v })}
            options={[1, 3, 5, 10, 30].map((n) => ({ value: n, label: `${n} seconds` }))}
          />
        </Row>
        <Row label="Version snapshots" hint="How often to keep a version while editing">
          <Select
            value={s.snapshotMinutes}
            onChange={(v) => update({ snapshotMinutes: v })}
            options={[1, 2, 5, 10, 15, 30].map((n) => ({ value: n, label: `Every ${n} min` }))}
          />
        </Row>
        <Row label="Versions to keep" hint="Per document; older ones are removed">
          <Select value={s.maxSnapshots} onChange={(v) => update({ maxSnapshots: v })} options={[10, 25, 50, 100, 200].map((n) => ({ value: n, label: String(n) }))} />
        </Row>
      </Section>

      <Section title="New documents">
        <Row label="Page size">
          <Select<PageSize>
            value={s.defaultPage.size}
            onChange={(size) => setDefaultPage({ size })}
            options={(Object.keys(PAGE_SIZES) as PageSize[]).map((k) => ({ value: k, label: PAGE_SIZES[k].label }))}
          />
        </Row>
        <Row label="Margins">
          <Select<MarginPreset>
            value={s.defaultPage.margins}
            onChange={(margins) => setDefaultPage({ margins })}
            options={(Object.keys(MARGINS) as MarginPreset[]).map((k) => ({ value: k, label: MARGINS[k].label }))}
          />
        </Row>
        <Row label="Font">
          <Select value={s.defaultPage.fontFamily} onChange={(fontFamily) => setDefaultPage({ fontFamily })} options={FONT_FAMILIES.map((f) => ({ value: f, label: f }))} />
        </Row>
        <Row label="Font size">
          <Select
            value={s.defaultPage.fontSize}
            onChange={(fontSize) => setDefaultPage({ fontSize })}
            options={[9, 10, 10.5, 11, 12, 13, 14, 16].map((n) => ({ value: n, label: `${n} pt` }))}
          />
        </Row>
      </Section>

      <Section title="Proofing">
        <Row label="Check spelling as you type">
          <Switch checked={s.spellcheck} onChange={(v) => update({ spellcheck: v })} label="Spell check" />
        </Row>
      </Section>

      <Section title="About">
        <Row label="PlutoDocs" hint={`Version ${appInfo?.version ?? "0.1.0"} · ${appInfo?.portable ? "Portable edition" : inTauri ? "Installed edition" : "Browser preview"}`}>
          <button type="button" onClick={() => openDialog({ kind: "about" })} className="flex size-7 items-center justify-center rounded-md text-fg-2 hover:bg-hover">
            <Info className="size-4" />
          </button>
        </Row>
        {inTauri && (
          <div className="px-3 py-2.5">
            <div className="text-[12.5px] font-medium">Data folder</div>
            <div className="mb-2 break-all text-[11px] text-fg-3">{appInfo?.dataDir}</div>
            <button
              type="button"
              onClick={() => void platform.openDataFolder()}
              className={clsx("flex items-center gap-1.5 text-[12px] font-medium text-accent hover:underline")}
            >
              <FolderCog className="size-3.5" /> Open data folder
            </button>
          </div>
        )}
      </Section>
    </div>
  );
}
