/**
 * YouTube Shorts thumbnails — vertical 9:16 (1080×1920).
 * Canvas fallback is high-contrast hook typography; prefer AI catalog when present.
 */

import { extractThumbnailHook } from "./thumbnailHooks";
import { resolvePrimaryAiThumbnail } from "./youtubeThumbnailCatalog";

const SHORTS_W = 1080;
const SHORTS_H = 1920;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function canvasToBase64(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/jpeg", 0.92).split(",")[1] ?? "";
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

function drawStrokedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fill: string,
  strokeW = 10,
) {
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.92)";
  ctx.lineWidth = strokeW;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/** Draw a vertical Shorts-style thumbnail with bold hook typography. */
export async function generateShortsThumbnail(opts: {
  title: string;
  thumbSrc?: string;
  accent?: string;
}): Promise<{ pngBase64: string; dataUrl: string }> {
  const canvas = document.createElement("canvas");
  canvas.width = SHORTS_W;
  canvas.height = SHORTS_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const accent = opts.accent ?? "#FF3B6E";
  const { hook, subline } = extractThumbnailHook(opts.title);

  if (opts.thumbSrc) {
    try {
      const img = await loadImage(opts.thumbSrc.startsWith("/") ? opts.thumbSrc : `/${opts.thumbSrc}`);
      const scale = Math.max(SHORTS_W / img.width, SHORTS_H / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (SHORTS_W - w) / 2, (SHORTS_H - h) / 2, w, h);
    } catch {
      ctx.fillStyle = "#0a0a0c";
      ctx.fillRect(0, 0, SHORTS_W, SHORTS_H);
    }
  } else {
    const g = ctx.createLinearGradient(0, 0, SHORTS_W, SHORTS_H);
    g.addColorStop(0, "#1a1030");
    g.addColorStop(1, "#0a0a0c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SHORTS_W, SHORTS_H);
  }

  // Slight global darken so text pops
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(0, 0, SHORTS_W, SHORTS_H);

  // Bottom vignette (Shorts title safe zone)
  const grad = ctx.createLinearGradient(0, SHORTS_H * 0.35, 0, SHORTS_H);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(0.35, "rgba(0,0,0,0.45)");
  grad.addColorStop(1, "rgba(0,0,0,0.94)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SHORTS_W, SHORTS_H);

  // Accent slash
  ctx.save();
  ctx.translate(56, SHORTS_H - 420);
  ctx.rotate(-0.08);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 14, 200);
  ctx.restore();

  const padX = 64;
  const maxW = SHORTS_W - padX * 2;
  let cursorY = SHORTS_H - 380;

  // Hook — huge, mobile-first
  const hookSize = hook.length > 18 ? 88 : hook.length > 12 ? 104 : 128;
  ctx.font = `900 ${hookSize}px "Inter Tight", "Arial Black", Impact, system-ui, sans-serif`;
  ctx.textBaseline = "top";
  const hookLines = wrapLines(ctx, hook, maxW, 3);
  for (const ln of hookLines) {
    drawStrokedText(ctx, ln, padX, cursorY, "#FFFFFF", 12);
    cursorY += hookSize * 1.05;
  }

  // Subline
  if (subline) {
    cursorY += 8;
    ctx.font = `700 52px "Inter Tight", "Segoe UI", system-ui, sans-serif`;
    const subLines = wrapLines(ctx, subline, maxW, 2);
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    for (const ln of subLines) {
      drawStrokedText(ctx, ln, padX, cursorY, "rgba(255,255,255,0.92)", 6);
      cursorY += 58;
    }
  }

  // Hindi Shorts pill
  ctx.font = '800 40px "Inter Tight", system-ui, sans-serif';
  const pill = "हिंदी SHORT";
  const pillW = ctx.measureText(pill).width + 36;
  const pillX = padX;
  const pillY = SHORTS_H - 100;
  ctx.fillStyle = accent;
  roundRect(ctx, pillX, pillY, pillW, 52, 10);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(pill, pillX + 18, pillY + 8);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  return { pngBase64: canvasToBase64(canvas), dataUrl };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function generateThumbnailForProject(opts: {
  title: string;
  thumbSrc?: string;
  isVertical: boolean;
  accent?: string;
  compId?: string;
  /** When set, skip AI catalog and force canvas composite. */
  forceCanvas?: boolean;
}): Promise<{ pngBase64: string; dataUrl: string; source: "ai" | "canvas" | "frame" } | null> {
  if (opts.compId && !opts.forceCanvas) {
    const ai = await resolvePrimaryAiThumbnail(opts.compId);
    if (ai) return { ...ai, source: "ai" };
  }

  if (opts.isVertical) {
    const canvas = await generateShortsThumbnail({
      title: opts.title,
      thumbSrc: opts.thumbSrc,
      accent: opts.accent,
    });
    return { ...canvas, source: "canvas" };
  }

  if (!opts.thumbSrc) return null;
  try {
    const res = await fetch(opts.thumbSrc.startsWith("/") ? opts.thumbSrc : `/${opts.thumbSrc}`);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result ?? ""));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : "";
    return base64 ? { pngBase64: base64, dataUrl, source: "frame" } : null;
  } catch {
    return null;
  }
}
