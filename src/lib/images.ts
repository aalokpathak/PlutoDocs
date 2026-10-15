/** Image helpers shared by insertion (file picker, paste, drop) and .docx export. */

const MAX_DIMENSION = 2400;
const RECOMPRESS_BYTES = 1.5 * 1024 * 1024;

export function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

/**
 * Converts an image file to a data URL for embedding. Very large photos are
 * scaled down and re-encoded so documents stay small and fast to save.
 */
export async function imageFileToDataUrl(file: Blob): Promise<string> {
  const dataUrl = await readAsDataUrl(file);
  if (file.size < RECOMPRESS_BYTES || !/^image\/(png|jpeg|webp|bmp)$/.test(file.type)) return dataUrl;
  try {
    const img = await loadImage(dataUrl);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const keepAlpha = file.type === "image/png";
    const out = canvas.toDataURL(keepAlpha ? "image/png" : "image/jpeg", 0.88);
    return out.length < dataUrl.length ? out : dataUrl;
  } catch {
    return dataUrl;
  }
}

export function dataUrlToBytes(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m) return null;
  const [, mime, isBase64, body] = m;
  if (isBase64) {
    const bin = atob(body);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { mime, bytes };
  }
  return { mime, bytes: new TextEncoder().encode(decodeURIComponent(body)) };
}

/** Rasterizes any displayable image (SVG, WebP, …) to PNG bytes. */
export async function rasterizeToPng(src: string): Promise<{ bytes: Uint8Array; width: number; height: number } | null> {
  try {
    const img = await loadImage(src);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || 800;
    canvas.height = img.naturalHeight || 600;
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const parsed = dataUrlToBytes(canvas.toDataURL("image/png"));
    return parsed ? { bytes: parsed.bytes, width: canvas.width, height: canvas.height } : null;
  } catch {
    return null;
  }
}
