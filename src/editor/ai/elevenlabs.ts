// Client helpers for the ElevenLabs dev proxies (see aiEndpointsPlugin in
// vite-plugins/ai-endpoints.mjs). The key is forwarded per-request; it is
// stored only in the browser via the Settings dialog.
//
// API shapes verified against elevenlabs.io docs:
//   GET  /v1/voices                     → { voices: [{ voice_id, name, labels, … }] }
//   POST /v1/text-to-speech/{voice_id}  → binary audio (default output_format
//        mp3_44100_128), body { text, model_id } with model_id defaulting to
//        "eleven_multilingual_v2".
//
// Eleven v3 (eleven_v3): inline audio tags in the script — [pause], [excited],
// Supports ElevenLabs v3 delivery tags such as [whispers], [sighs], and [curious].

export interface Voice {
  voiceId: string;
  name: string;
  labels?: Record<string, string>;
}

interface RawVoice {
  voice_id?: string;
  name?: string;
  labels?: Record<string, string>;
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const j = (await res.json()) as { error?: unknown; detail?: unknown };
    const detail = j.error ?? j.detail;
    if (typeof detail === "string") return detail.slice(0, 300);
    if (detail) return JSON.stringify(detail).slice(0, 300);
  } catch {
    // fall through
  }
  return fallback;
}

function describeStatus(status: number): string {
  if (status === 401) return "ElevenLabs API key is invalid";
  if (status === 429) return "ElevenLabs quota exceeded (rate limit or plan)";
  if (status === 422) return "ElevenLabs rejected the request (validation error)";
  return `ElevenLabs request failed (HTTP ${status})`;
}

/** List the voices available to this API key. */
export async function listVoices(apiKey: string): Promise<Voice[]> {
  const res = await fetch(`/api/voices?apiKey=${encodeURIComponent(apiKey)}`);
  if (!res.ok) {
    throw new Error(await readError(res, describeStatus(res.status)));
  }
  const json = (await res.json()) as { voices?: RawVoice[] };
  return (json.voices ?? [])
    .filter((v) => v.voice_id)
    .map((v) => ({
      voiceId: String(v.voice_id),
      name: String(v.name ?? v.voice_id),
      labels: v.labels,
    }));
}

/** Synthesize speech; resolves to an audio/mpeg Blob. */
export async function synthesize(opts: {
  apiKey: string;
  voiceId: string;
  text: string;
  modelId?: string;
}): Promise<Blob> {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      voiceId: opts.voiceId,
      text: opts.text,
      modelId: opts.modelId ?? "eleven_multilingual_v2",
      apiKey: opts.apiKey,
    }),
  });
  if (!res.ok) {
    throw new Error(await readError(res, describeStatus(res.status)));
  }
  const blob = await res.blob();
  if (blob.size === 0) {
    throw new Error("ElevenLabs returned empty audio");
  }
  return blob;
}

