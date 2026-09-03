// Client helpers for the Gemini dev proxy (see aiEndpointsPlugin in
// vite-plugins/ai-endpoints.mjs). All calls go through POST /api/gemini so the
// API key never appears in a browser-visible third-party request.
//
// REST shapes verified against ai.google.dev: requests are camelCase
// (`contents[].parts[].text`, `generationConfig.responseModalities`,
// `generationConfig.imageConfig.aspectRatio`); image bytes come back in
// `candidates[].content.parts[].inlineData.{mimeType,data}` (some proxies emit
// snake_case `inline_data` — we parse both); errors are
// `{error:{code,message,status}}`.

/** Nano Banana Pro. */
const DEFAULT_IMAGE_MODEL = "gemini-3-pro-image-preview";
/** Fallback when the preview model 404s or the key lacks access. */
const FALLBACK_IMAGE_MODEL = "gemini-2.5-flash-image";
const DEFAULT_VISION_MODEL = "gemini-2.5-flash";

export interface GeneratedImage {
  pngBase64: string;
  mimeType: string;
}

export interface VisionReviewResult {
  score: number;
  verdict: string;
  issues: string[];
  suggestions: string[];
}

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
  inline_data?: { mime_type?: string; data?: string };
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  error?: { code?: number; message?: string; status?: string };
}

/** Turn a Gemini error payload + HTTP status into a human-readable message. */
function describeError(status: number, err?: { code?: number; message?: string; status?: string }): string {
  const upstream = err?.message ? ` — ${err.message}` : "";
  if (status === 429 || err?.status === "RESOURCE_EXHAUSTED") {
    return `Gemini quota exceeded (rate limit or billing)${upstream}`;
  }
  if (status === 400 && /api key/i.test(err?.message ?? "")) {
    return `Gemini API key is invalid${upstream}`;
  }
  if (status === 401 || status === 403 || err?.status === "PERMISSION_DENIED") {
    return `Gemini API key is invalid or lacks access to this model${upstream}`;
  }
  if (status === 404 || err?.status === "NOT_FOUND") {
    return `Gemini model not found for this key${upstream}`;
  }
  return `Gemini request failed (HTTP ${status})${upstream}`;
}

/** True when the failure means "this model isn't available to you" → try fallback. */
function isModelUnavailable(status: number, err?: { message?: string; status?: string }): boolean {
  if (status === 404 || status === 403 || status === 401) return true;
  const s = `${err?.status ?? ""} ${err?.message ?? ""}`.toLowerCase();
  return s.includes("not_found") || s.includes("not found") || s.includes("permission");
}

async function callGemini(
  model: string,
  body: Record<string, unknown>,
  apiKey: string,
): Promise<{ status: number; json: GeminiResponse }> {
  const res = await fetch("/api/gemini", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, body, apiKey }),
  });
  let json: GeminiResponse = {};
  try {
    json = (await res.json()) as GeminiResponse;
  } catch {
    json = { error: { code: res.status, message: "non-JSON response from proxy" } };
  }
  return { status: res.status, json };
}

function extractImageParts(json: GeminiResponse): GeneratedImage[] {
  const out: GeneratedImage[] = [];
  for (const cand of json.candidates ?? []) {
    for (const part of cand.content?.parts ?? []) {
      const inline = part.inlineData ?? part.inline_data;
      const data = inline?.data;
      if (data) {
        const mime =
          (part.inlineData?.mimeType ?? part.inline_data?.mime_type ?? "image/png") || "image/png";
        out.push({ pngBase64: data, mimeType: mime });
      }
    }
  }
  return out;
}

function extractText(json: GeminiResponse): string {
  const chunks: string[] = [];
  for (const cand of json.candidates ?? []) {
    for (const part of cand.content?.parts ?? []) {
      if (typeof part.text === "string") chunks.push(part.text);
    }
  }
  return chunks.join("\n");
}

/** A reference image attached to a generation request for style matching. */
export interface ReferenceImage {
  base64: string;
  mimeType: string;
}

/**
 * Fetch same-origin image URLs (e.g. "/style-refs/foo.png") and return them as
 * base64 reference images. Failures are skipped silently — a missing reference
 * should degrade to a text-only prompt, not break generation.
 */
export async function fetchReferenceImages(urls: string[]): Promise<ReferenceImage[]> {
  const results = await Promise.all(
    urls.map(async (url): Promise<ReferenceImage | null> => {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error("failed to read blob"));
          reader.onload = () => resolve(String(reader.result ?? ""));
          reader.readAsDataURL(blob);
        });
        return {
          base64: dataUrl.slice(dataUrl.indexOf(",") + 1),
          mimeType: blob.type || "image/png",
        };
      } catch {
        return null;
      }
    }),
  );
  return results.filter((r): r is ReferenceImage => r !== null);
}

/**
 * Generate one or more images. Defaults to Nano Banana Pro
 * ('gemini-3-pro-image-preview') and automatically falls back to
 * 'gemini-2.5-flash-image' when the preview model is unavailable to the key
 * (404 / permission errors).
 *
 * Optional referenceImages are attached before the text prompt so the model
 * style-matches curated examples (Nano Banana follows visual references far
 * more faithfully than text descriptions alone).
 */
export async function generateImages(opts: {
  prompt: string;
  apiKey: string;
  count?: number;
  aspectRatio?: string;
  model?: string;
  referenceImages?: ReferenceImage[];
}): Promise<GeneratedImage[]> {
  const count = Math.max(1, Math.min(4, Math.floor(opts.count ?? 1)));
  const refParts = (opts.referenceImages ?? []).map((ref) => ({
    inlineData: { mimeType: ref.mimeType, data: ref.base64 },
  }));
  const body: Record<string, unknown> = {
    contents: [{ parts: [...refParts, { text: opts.prompt }] }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      ...(opts.aspectRatio ? { imageConfig: { aspectRatio: opts.aspectRatio } } : {}),
    },
  };

  let model = opts.model ?? DEFAULT_IMAGE_MODEL;
  const images: GeneratedImage[] = [];

  for (let i = 0; i < count; i++) {
    let { status, json } = await callGemini(model, body, opts.apiKey);

    // Automatic fallback: the preview model may not be enabled for every key.
    if ((status < 200 || status >= 300 || json.error) && model !== FALLBACK_IMAGE_MODEL) {
      if (isModelUnavailable(status, json.error)) {
        model = FALLBACK_IMAGE_MODEL;
        ({ status, json } = await callGemini(model, body, opts.apiKey));
      }
    }
    if (status < 200 || status >= 300 || json.error) {
      throw new Error(describeError(status, json.error));
    }
    const parts = extractImageParts(json);
    if (parts.length === 0) {
      const text = extractText(json);
      throw new Error(
        text
          ? `Gemini returned no image (model said: ${text.slice(0, 200)})`
          : "Gemini returned no image data",
      );
    }
    images.push(...parts);
    if (images.length >= count) break;
  }
  return images.slice(0, count);
}

/**
 * Ask a Gemini vision model to review a generated asset against a rubric.
 * Requests JSON output and parses it tolerantly (code fences, extra prose).
 */
export async function visionReview(opts: {
  pngBase64: string;
  rubric: string;
  apiKey: string;
  model?: string;
}): Promise<VisionReviewResult> {
  const model = opts.model ?? DEFAULT_VISION_MODEL;
  const instruction = [
    "You are a strict art director reviewing an AI-generated video asset.",
    "Review the attached image against this rubric:",
    opts.rubric,
    "",
    'Respond with ONLY a JSON object: {"score": <0-100 integer>, "verdict": "<one sentence>", "issues": ["<problem>", ...], "suggestions": ["<improvement>", ...]}',
  ].join("\n");

  const body: Record<string, unknown> = {
    contents: [
      {
        parts: [
          { inlineData: { mimeType: "image/png", data: opts.pngBase64 } },
          { text: instruction },
        ],
      },
    ],
    generationConfig: { responseMimeType: "application/json" },
  };

  const { status, json } = await callGemini(model, body, opts.apiKey);
  if (status < 200 || status >= 300 || json.error) {
    throw new Error(describeError(status, json.error));
  }

  const raw = extractText(json);
  return parseReview(raw);
}

/** Tolerant parse of the review JSON — never throws, degrades to a raw-text verdict. */
function parseReview(raw: string): VisionReviewResult {
  const fallback: VisionReviewResult = {
    score: 0,
    verdict: raw.trim().slice(0, 300) || "Model returned an empty review",
    issues: [],
    suggestions: [],
  };
  const stripped = raw.replace(/```(?:json)?/gi, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end <= start) return fallback;
  try {
    const parsed = JSON.parse(stripped.slice(start, end + 1)) as Record<string, unknown>;
    const toStrings = (v: unknown): string[] =>
      Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
    const scoreNum = Number(parsed.score);
    return {
      score: Number.isFinite(scoreNum) ? Math.max(0, Math.min(100, Math.round(scoreNum))) : 0,
      verdict: typeof parsed.verdict === "string" ? parsed.verdict : fallback.verdict,
      issues: toStrings(parsed.issues),
      suggestions: toStrings(parsed.suggestions),
    };
  } catch {
    return fallback;
  }
}

/**
 * Wrap a subject in a flat-vector-infographic prompt template. The solid,
 * uniform background color makes downstream background removal clean, and the
 * fixed palette keeps assets consistent across a video.
 */
export function buildInfographicAssetPrompt(subject: string, stylePreset: string): string {
  return [
    `A single ${subject}, rendered as a flat vector infographic asset in the "${stylePreset}" style.`,
    "Clean 2D flat-design illustration with bold simple shapes, smooth curves and crisp edges.",
    "Consistent limited palette: vivid accent colors with soft shading only, no gradients heavier than two stops, no texture noise.",
    "The subject is perfectly centered with generous even margins on every side and never touches the image edges.",
    "Plain solid uniform light-gray (#EEEEEE) background with absolutely nothing else on it — no shadows cast on the background, no floor line, no text, no watermark, no border, no frame.",
    "High resolution, sharp and crisp, suitable as a cut-out overlay asset in a video infographic.",
  ].join(" ");
}
