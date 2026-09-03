// Deterministic asset QA. The pure pixel analyzer lives in qa-core.mjs (plain
// JS with JSDoc) so scripts/qa-selftest.mjs can run the IDENTICAL code under
// node; this module re-exports it typed and adds the browser canvas wrapper.

import { analyzeRGBA as analyzeRGBACore, type AssetQAReport } from "./qa-core.mjs";

export type { AssetQAReport };

/**
 * Analyze raw RGBA pixels — PURE function, no DOM (see qa-core.mjs for the
 * check definitions: min resolution 512, alpha coverage, subject bbox +
 * margins, edge-halo score; `passes` = no hard issues).
 */
export const analyzeRGBA: (data: Uint8ClampedArray, width: number, height: number) => AssetQAReport =
  analyzeRGBACore;

/** Browser wrapper: decode an image Blob via canvas and run analyzeRGBA. */
export async function analyzeImageBlob(blob: Blob): Promise<AssetQAReport> {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      throw new Error("2D canvas context unavailable");
    }
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return analyzeRGBA(imageData.data, canvas.width, canvas.height);
  } finally {
    bitmap.close();
  }
}
