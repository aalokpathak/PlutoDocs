import type { Editor } from "@tiptap/react";
import { imageFileToDataUrl } from "@/lib/images";
import { errorMessage, extensionOf, platform } from "@/lib/platform";
import { useApp } from "@/store/app";

const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
};

/** Opens a native picker and embeds the chosen image into the document. */
export async function pickAndInsertImage(editor: Editor) {
  try {
    const picked = await platform.pickOpen([{ name: "Images", extensions: Object.keys(IMAGE_TYPES) }]);
    if (!picked) return;
    const blob =
      picked.file ?? new Blob([await platform.readBinary(picked.path)], { type: IMAGE_TYPES[extensionOf(picked.path)] ?? "image/png" });
    const src = await imageFileToDataUrl(blob);
    editor
      .chain()
      .focus()
      .setImage({ src, alt: picked.name.replace(/\.[^.]+$/, "") })
      .run();
  } catch (e) {
    useApp.getState().toast({ tone: "error", title: "Couldn't insert picture", body: errorMessage(e) });
  }
}
