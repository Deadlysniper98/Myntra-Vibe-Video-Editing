/** Tie rendered files in `out/` to a Remotion composition id. */

const LAST_RENDER_KEY = "vibe.lastRenderByComp";

export function renderBasenameForComp(compId: string): string {
  return compId.toLowerCase();
}

export function defaultRenderFilename(compId: string, ext = "mp4"): string {
  return `${renderBasenameForComp(compId)}.${ext}`;
}

/** True when a file in `out/` belongs to this composition (by naming convention). */
export function renderMatchesComp(filename: string, compId: string): boolean {
  const base = renderBasenameForComp(compId);
  const stem = filename.replace(/\.[^.]+$/i, "").toLowerCase();
  return stem === base || stem.startsWith(`${base}-`) || stem.startsWith(`${base}_`);
}

export function filterRendersForComp<T extends { filename: string }>(
  files: T[],
  compId: string,
): T[] {
  return files.filter((f) => renderMatchesComp(f.filename, compId));
}

export function saveLastRenderForComp(compId: string, filename: string): void {
  try {
    const raw = localStorage.getItem(LAST_RENDER_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, { filename: string; at: string }>) : {};
    all[compId] = { filename, at: new Date().toISOString() };
    localStorage.setItem(LAST_RENDER_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function getLastRenderForComp(compId: string): string | null {
  return getLastRenderMeta(compId)?.filename ?? null;
}

export function getLastRenderMeta(compId: string): { filename: string; at: string } | null {
  try {
    const raw = localStorage.getItem(LAST_RENDER_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as Record<string, { filename: string; at?: string }>;
    const entry = all[compId];
    if (!entry?.filename) return null;
    return { filename: entry.filename, at: entry.at ?? "" };
  } catch {
    return null;
  }
}

export function pickRenderForComp(
  files: { filename: string }[],
  compId: string,
): string {
  const matching = filterRendersForComp(files, compId);
  const last = getLastRenderForComp(compId);
  if (last && matching.some((f) => f.filename === last)) return last;

  const preferred = defaultRenderFilename(compId);
  if (matching.some((f) => f.filename === preferred)) return preferred;

  if (matching.length > 0) return matching[0].filename;

  return preferred;
}
