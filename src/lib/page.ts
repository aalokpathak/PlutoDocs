import type { MarginPreset, PageSetup, PageSize } from "@/lib/types";

/** Portrait page sizes in inches. */
export const PAGE_SIZES: Record<PageSize, { label: string; detail: string; width: number; height: number }> = {
  a4: { label: "A4", detail: "21 × 29.7 cm", width: 8.2677, height: 11.6929 },
  letter: { label: "Letter", detail: "8.5 × 11 in", width: 8.5, height: 11 },
  legal: { label: "Legal", detail: "8.5 × 14 in", width: 8.5, height: 14 },
  a5: { label: "A5", detail: "14.8 × 21 cm", width: 5.8268, height: 8.2677 },
};

/** Margins in inches: top, right, bottom, left. */
export const MARGINS: Record<MarginPreset, { label: string; detail: string; value: [number, number, number, number] }> = {
  normal: { label: "Normal", detail: "1 in all sides", value: [1, 1, 1, 1] },
  narrow: { label: "Narrow", detail: "0.5 in all sides", value: [0.5, 0.5, 0.5, 0.5] },
  moderate: { label: "Moderate", detail: "1 in × 0.75 in", value: [1, 0.75, 1, 0.75] },
  wide: { label: "Wide", detail: "1 in × 2 in", value: [1, 2, 1, 2] },
};

export const PX_PER_INCH = 96;

export function pageInches(setup: PageSetup) {
  const size = PAGE_SIZES[setup.size];
  const landscape = setup.orientation === "landscape";
  const [top, right, bottom, left] = MARGINS[setup.margins].value;
  return {
    width: landscape ? size.height : size.width,
    height: landscape ? size.width : size.height,
    top,
    right,
    bottom,
    left,
  };
}

export function pagePixels(setup: PageSetup) {
  const inches = pageInches(setup);
  return Object.fromEntries(Object.entries(inches).map(([k, v]) => [k, Math.round(v * PX_PER_INCH)])) as typeof inches;
}

/** CSS font stack for a document font, with metric-compatible fallbacks. */
export function fontStack(family: string): string {
  const fallbacks: Record<string, string> = {
    Calibri: "Calibri, Carlito, 'Segoe UI', sans-serif",
    Aptos: "Aptos, Calibri, 'Segoe UI', sans-serif",
    Cambria: "Cambria, Caladea, Georgia, serif",
    "Times New Roman": "'Times New Roman', Tinos, Times, serif",
    Arial: "Arial, Arimo, Helvetica, sans-serif",
  };
  return fallbacks[family] ?? `'${family}', 'Segoe UI', sans-serif`;
}

export const DEFAULT_PAGE: PageSetup = {
  size: "a4",
  orientation: "portrait",
  margins: "normal",
  fontFamily: "Calibri",
  fontSize: 11,
};
