// Background removal for generated assets — wraps @imgly/background-removal
// (runs fully in the browser via ONNX/WASM; model weights are fetched from the
// package's CDN publicPath on first use, then cached).

import { removeBackground } from "@imgly/background-removal";

/**
 * Remove the background from an image. Quality-focused configuration: the
 * full-precision "isnet" model and lossless PNG output so the alpha matte is
 * preserved exactly for downstream QA + compositing.
 */
export async function removeBg(input: Blob): Promise<Blob> {
  return removeBackground(input, {
    model: "isnet",
    output: {
      format: "image/png",
      quality: 1,
    },
  });
}
