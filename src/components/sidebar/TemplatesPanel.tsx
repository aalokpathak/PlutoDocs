import { useMemo } from "react";
import { newDocument } from "@/lib/documents";
import { getTemplates, type Template } from "@/lib/templates";

/** Miniature, non-interactive render of the template's first page. */
function Thumbnail({ template }: { template: Template }) {
  return (
    <div className="relative h-[124px] overflow-hidden rounded-md border border-stroke bg-white shadow-card">
      {template.html ? (
        <div
          className="pluto-doc pointer-events-none absolute left-0 top-0 w-[500px] origin-top-left scale-[0.26] p-10 [--pd-ink:#1f2026]"
          // Templates are bundled, trusted HTML.
          dangerouslySetInnerHTML={{ __html: template.html }}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-[28px] font-light text-[#9aa0b4]">+</div>
      )}
    </div>
  );
}

export function TemplatesPanel() {
  const templates = useMemo(getTemplates, []);
  const categories = [...new Set(templates.map((t) => t.category))];
  return (
    <div className="space-y-3 px-1">
      {categories.map((cat) => (
        <section key={cat}>
          <div className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-3">{cat}</div>
          <div className="grid grid-cols-2 gap-2.5">
            {templates
              .filter((t) => t.category === cat)
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  title={t.description}
                  onClick={() => void newDocument({ html: t.html, name: t.id === "blank" ? undefined : t.name })}
                  className="group rounded-lg p-1.5 text-left transition-colors hover:bg-hover"
                >
                  <div className="transition-transform duration-150 group-hover:-translate-y-0.5">
                    <Thumbnail template={t} />
                  </div>
                  <div className="mt-1.5 truncate px-0.5 text-[12.5px] font-medium">{t.name}</div>
                  <div className="truncate px-0.5 text-[11px] text-fg-3">{t.description}</div>
                </button>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
