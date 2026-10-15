import { errorMessage, inTauri } from "@/lib/platform";
import { useApp } from "@/store/app";

/** Adds https:// to bare domains; leaves mailto:, tel:, #anchors and full URLs alone. */
export function normalizeUrl(raw: string): string {
  const url = raw.trim();
  if (!url) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("#") || url.startsWith("/")) return url;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url)) return `mailto:${url}`;
  return `https://${url}`;
}

/** Opens a link in the user's default browser (never inside the app window). */
export async function openExternal(href: string) {
  const url = normalizeUrl(href);
  if (!/^(https?|mailto|tel):/i.test(url)) return;
  try {
    if (inTauri) {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  } catch (e) {
    useApp.getState().toast({ tone: "error", title: "Couldn't open link", body: errorMessage(e) });
  }
}
