/** Thumbnail choices for the MynnovAIte compositions. */
export interface ThumbnailCatalogEntry { id: string; label: string; src: string; }
export interface ThumbnailManifest { compositionId: string; thumbnails: ThumbnailCatalogEntry[]; }

const FALLBACK: ThumbnailCatalogEntry[] = [
  { id: "hackerramp-logo", label: "Hackerramp logo", src: "/hackerramp-logo.png" },
  { id: "women-in-tech-logo", label: "Women in Tech logo", src: "/women-in-tech-logo.png" },
];

export function getThumbnailManifestUrl(_compId: string): string | null { return null; }
export function getFallbackThumbnails(_compId: string): ThumbnailCatalogEntry[] { return FALLBACK; }

async function entryExists(src: string): Promise<boolean> {
  try { const res = await fetch(src, { method: "HEAD" }); return res.ok; } catch { return false; }
}

export async function resolveThumbnailCatalog(compId: string): Promise<ThumbnailCatalogEntry[]> {
  const checks = await Promise.all(getFallbackThumbnails(compId).map(async (t) => (await entryExists(t.src)) ? t : null));
  return checks.filter((t): t is ThumbnailCatalogEntry => t !== null);
}

export interface LoadedThumbnail { id: string; label: string; src: string; dataUrl: string; pngBase64: string; }
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(blob);
  });
}

export async function loadThumbnailAssets(entries: ThumbnailCatalogEntry[]): Promise<LoadedThumbnail[]> {
  const results = await Promise.all(entries.map(async (entry) => {
    try {
      const res = await fetch(entry.src);
      if (!res.ok) return null;
      const dataUrl = await blobToDataUrl(await res.blob());
      const pngBase64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : "";
      return pngBase64 ? { ...entry, dataUrl, pngBase64 } satisfies LoadedThumbnail : null;
    } catch { return null; }
  }));
  return results.filter((t): t is LoadedThumbnail => t !== null);
}

export async function resolvePrimaryAiThumbnail(compId: string): Promise<{ pngBase64: string; dataUrl: string } | null> {
  const catalog = await resolveThumbnailCatalog(compId);
  const loaded = catalog[0] ? await loadThumbnailAssets([catalog[0]]) : [];
  return loaded[0] ? { pngBase64: loaded[0].pngBase64, dataUrl: loaded[0].dataUrl } : null;
}
