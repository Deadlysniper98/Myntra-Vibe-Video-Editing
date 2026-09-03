// Client helpers for the dev render endpoint (see renderApiPlugin in vite.config.ts).

export interface RenderFormat {
  id: string;
  label: string;
  codec: string;
  ext: string;
  video: boolean; // video codecs take a CRF
}

export const RENDER_FORMATS: RenderFormat[] = [
  { id: "mp4-h264", label: "MP4 · H.264", codec: "h264", ext: "mp4", video: true },
  { id: "mp4-h265", label: "MP4 · H.265 (HEVC)", codec: "h265", ext: "mp4", video: true },
  { id: "webm-vp9", label: "WebM · VP9", codec: "vp9", ext: "webm", video: true },
  { id: "gif", label: "GIF", codec: "gif", ext: "gif", video: false },
];

export interface RenderSettings {
  formatId: string;
  crf: number; // lower = higher quality
  resolution: number; // target height (720 · 1080 · 2160) — drives scale
  scale: number; // derived from resolution + composition size
  fps: number; // output frame rate
  startFrame: number;
  endFrame: number;
  filename: string;
}

export interface RenderJob {
  id?: string;
  status: "idle" | "rendering" | "done" | "error";
  progress: number;
  output: string; // download URL when done
  error: string;
}

export const formatOf = (id: string) =>
  RENDER_FORMATS.find((f) => f.id === id) ?? RENDER_FORMATS[0];

// Merge the chosen fps into the composition props (the comp's calculateMetadata reads it).
function mergeProps(s: RenderSettings, props: unknown) {
  return { ...(props && typeof props === "object" ? (props as object) : {}), fps: s.fps };
}

function body(compId: string, s: RenderSettings, props: unknown) {
  const fmt = formatOf(s.formatId);
  return {
    compId,
    codec: fmt.codec,
    crf: fmt.video ? s.crf : undefined,
    scale: s.scale,
    frames: `${s.startFrame}-${s.endFrame}`,
    filename: s.filename,
    props: mergeProps(s, props),
  };
}

export async function startRender(compId: string, s: RenderSettings, props: unknown): Promise<string> {
  const res = await fetch("/api/render", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body(compId, s, props)),
  });
  const j = await res.json();
  return j.id as string;
}

export async function getRenderStatus(id: string): Promise<RenderJob> {
  const res = await fetch(`/api/render?id=${encodeURIComponent(id)}`);
  return res.json();
}

// The equivalent CLI command — shown for transparency / running outside the editor.
export function buildCliCommand(compId: string, s: RenderSettings, props: unknown): string {
  const fmt = formatOf(s.formatId);
  const parts = ["npx remotion render src/index.ts", compId, `out/${s.filename}`, `--codec=${fmt.codec}`];
  if (fmt.video) parts.push(`--crf=${s.crf}`);
  if (s.scale !== 1) parts.push(`--scale=${s.scale}`);
  parts.push(`--frames=${s.startFrame}-${s.endFrame}`);
  parts.push(`--props='${JSON.stringify(mergeProps(s, props))}'`);
  return parts.join(" ");
}
