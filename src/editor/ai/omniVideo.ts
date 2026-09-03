// Client helpers for Gemini Omni Flash (gemini-omni-flash-preview) video
// generation via the dev proxy (see handleOmniVideo in
// vite-plugins/ai-endpoints.mjs). All calls go through POST /api/omni-video
// so the API key never appears in a browser-visible third-party request.
//
// Interactions API request/response shapes verified against
// ai.google.dev/gemini-api/docs/omni: this is a DIFFERENT endpoint from
// generateContent (used by gemini.ts) — snake_case body (`input`,
// `response_format`, `previous_interaction_id`), and video output lives in
// `steps[].content[].{type:"video", data|uri, mime_type}`, not
// `candidates[].content.parts[].inlineData` like image generation.
//
// See docs/ai-services-reference.md "Video generation — Gemini Omni Flash
// (preview)" for pricing, capability, and fit-for-this-project notes before
// wiring this into a UI flow.

const MODEL = "gemini-omni-flash-preview";

export type OmniAspectRatio = "16:9" | "9:16";
export type OmniVideoTask = "text_to_video" | "image_to_video" | "reference_to_video" | "edit";

export interface OmniImageInput {
  base64: string;
  mimeType: string;
}

export interface OmniVideoResult {
  /** Present when response_format.delivery is "video" (default, ≤4MB). */
  videoBase64?: string;
  /** Present when response_format.delivery is "uri" (>4MB, needs Files API polling). */
  videoUri?: string;
  mimeType: string;
  /** Interaction id — pass as previousInteractionId to edit this result in a follow-up turn. */
  interactionId: string;
}

interface OmniContentPart {
  type?: string;
  data?: string;
  uri?: string;
  mime_type?: string;
}

interface OmniStep {
  type?: string;
  content?: OmniContentPart[];
}

interface OmniResponse {
  id?: string;
  status?: string;
  steps?: OmniStep[];
  error?: { code?: number; message?: string; status?: string };
}

async function callOmni(body: Record<string, unknown>, apiKey: string): Promise<{ status: number; json: OmniResponse }> {
  const res = await fetch("/api/omni-video", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ body, apiKey }),
  });
  let json: OmniResponse = {};
  try {
    json = (await res.json()) as OmniResponse;
  } catch {
    json = { error: { code: res.status, message: "non-JSON response from proxy" } };
  }
  return { status: res.status, json };
}

function describeError(status: number, err?: { code?: number; message?: string; status?: string }): string {
  const upstream = err?.message ? ` — ${err.message}` : "";
  if (status === 429 || err?.status === "RESOURCE_EXHAUSTED") {
    return `Omni Flash quota exceeded (rate limit or billing)${upstream}`;
  }
  if (status === 401 || status === 403 || err?.status === "PERMISSION_DENIED") {
    return `Gemini API key is invalid or lacks paid-tier access to Omni Flash${upstream}`;
  }
  if (status === 400) {
    return `Omni Flash request rejected${upstream}`;
  }
  return `Omni Flash request failed (HTTP ${status})${upstream}`;
}

function extractVideo(json: OmniResponse): OmniVideoResult {
  for (const step of json.steps ?? []) {
    if (step.type !== "model_output") continue;
    for (const part of step.content ?? []) {
      if (part.type === "video" && (part.data || part.uri)) {
        return {
          videoBase64: part.data,
          videoUri: part.uri,
          mimeType: part.mime_type || "video/mp4",
          interactionId: json.id ?? "",
        };
      }
    }
  }
  throw new Error("Omni Flash returned no video output");
}

/**
 * Generate a video with Gemini Omni Flash. Defaults to a fast, synchronous,
 * non-editable call (`background: false, store: false, stream: false`, per
 * Google's own performance guidance) — pass `store: true` if you plan to
 * follow up with `previousInteractionId` for iterative editing.
 */
export async function generateVideo(opts: {
  prompt: string;
  apiKey: string;
  aspectRatio?: OmniAspectRatio;
  images?: OmniImageInput[];
  task?: OmniVideoTask;
  previousInteractionId?: string;
  deliverAsUri?: boolean;
  store?: boolean;
}): Promise<OmniVideoResult> {
  const imageParts = (opts.images ?? []).map((img) => ({
    type: "image",
    data: img.base64,
    mime_type: img.mimeType,
  }));
  const input =
    imageParts.length > 0 ? [...imageParts, { type: "text", text: opts.prompt }] : opts.prompt;

  const responseFormat: Record<string, unknown> = { type: "video" };
  if (opts.aspectRatio) responseFormat.aspect_ratio = opts.aspectRatio;
  if (opts.deliverAsUri) responseFormat.delivery = "uri";

  const body: Record<string, unknown> = {
    model: MODEL,
    input,
    background: false,
    stream: false,
    store: opts.store ?? false,
    response_format: responseFormat,
    ...(opts.previousInteractionId ? { previous_interaction_id: opts.previousInteractionId } : {}),
    ...(opts.task ? { generation_config: { video_config: { task: opts.task } } } : {}),
  };

  const { status, json } = await callOmni(body, opts.apiKey);
  if (status < 200 || status >= 300 || json.error) {
    throw new Error(describeError(status, json.error));
  }
  return extractVideo(json);
}
