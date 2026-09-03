// YouTube → Shorts clip analysis — Phase 1 of the "paste a link, get a video"
// content pipeline (see docs/content-pipeline-plan.md).
//
// Sends the YouTube URL directly to Gemini's native video understanding (it
// processes real audio + 1fps visual frames together — confirmed faster/more
// accurate transcription than Whisper on YouTube-length clips per Google's own
// benchmark) and asks for ranked candidate moments in ONE call. No separate
// transcription/ASR step, no yt-dlp needed for this analysis stage.
//
// Scoring rubric follows the pattern every commercial "auto-clip" tool
// (OpusClip, quso.ai/vidyo.ai, Vizard, Klap) converges on — Hook / Flow / Value
// / Trend — plus SamurAIGPT's more granular open-source criteria (MIT license,
// github.com/SamurAIGPT/AI-Youtube-Shorts-Generator): hooks, emotional peaks,
// opinion bombs, revelations, conflict, quotable lines, story beats, practical
// value. This is the industry's well-known shape, not proprietary.
//
// Uses the existing generic /api/gemini proxy (vite-plugins/ai-endpoints.mjs) —
// no new server endpoint needed; that proxy forwards any {model, body, apiKey}.

/**
 * Where to crop a HORIZONTAL (16:9) source when reframing this moment into the
 * vertical Shorts canvas. Irrelevant for already-vertical Shorts sources (the
 * pipeline ignores it then). `focalX`/`focalY` feed <ReframedVideo>'s crop; the
 * analyzer fills these from actually watching the shot (e.g. "speaker is in the
 * left third" → focalX ≈ 0.33), so long-form clips don't default to a blind
 * center crop that can behead an off-center subject.
 */
export interface ReframeHint {
  /** Horizontal focal point 0 (left) … 1 (right); 0.5 = center. */
  focalX: number;
  /** Vertical focal point 0 (top) … 1 (bottom); 0.5 = center. */
  focalY: number;
  /** True if the subject drifts across the shot and a static crop would clip it. */
  subjectMoves: boolean;
  /** One phrase, e.g. "host seated left; keep focalX≈0.35". */
  note: string;
}

export interface CandidateClip {
  startSec: number;
  endSec: number;
  /** One-line reason this moment was picked (English, for the curator's UI). */
  rationale: string;
  /** Hindi translation of the moment's hook/key line, ready for the VO script. */
  hookHi: string;
  scores: { hook: number; flow: number; value: number; trend: number };
  /** Mean of the four scores, 0-100, used for default sort. */
  overall: number;
  /** Crop guidance for 16:9→9:16 reframing (present only for horizontal sources). */
  reframe?: ReframeHint;
}

/**
 * Whether the SOURCE footage already has burned-in on-screen text (TikTok/
 * Shorts-style captions baked into the pixels — NOT YouTube's separate CC
 * subtitle track, which isn't visible in the video frames at all). This
 * matters because our own Hindi subtitles have to share the frame with
 * whatever's already there — clean footage means full layout freedom;
 * heavily-captioned footage means fighting for space (see
 * positioning specifically because its source had burned-in captions).
 */
export interface CaptionAudit {
  hasBurnedInText: boolean;
  /** Rough % of the runtime where burned-in text is on screen, 0-100. */
  coveragePct: number;
  /** One sentence, e.g. "Bold white captions with black stroke, bottom third, ~80% of runtime." */
  note: string;
}

export interface AnalyzeResult {
  videoTitle: string;
  /** True when the source is 16:9/landscape and clips need reframing to 9:16. */
  sourceIsHorizontal: boolean;
  captionAudit: CaptionAudit;
  clips: CandidateClip[];
}

const RUBRIC_PROMPT = `You are analyzing a YouTube video to select the best moments for a short-form
Hindi-narrated YouTube Short (20-40 seconds each). Watch and listen to the actual video
(audio + visuals), not just infer from the title.

FIRST, audit the footage itself: does it already have burned-in on-screen text baked into the
video (like TikTok/Shorts-style captions, reaction-video subtitles, or any overlaid words that
are part of the pixels, not a separate CC track)? This matters because our own Hindi subtitles
will need to share the frame with whatever's already there. Report this honestly — silent
process/craft/nature/repair footage is usually clean; reaction/vlog/commentary videos usually
have burned-in captions.

SECOND, note the video's orientation. If it is HORIZONTAL (16:9 / landscape, i.e. a normal YouTube
video rather than an already-vertical Short), then for each clip you must ALSO say where to crop it
for a vertical 9:16 Short — because a blind center-crop can behead a subject sitting off to one
side. If the video is already vertical, set "sourceIsHorizontal" false and omit "reframe" on clips.

THIRD, for each candidate moment, score 0-100 on these four factors (the same shape every major
clipping tool converges on):
- hook: does this moment grab attention in its first 2 seconds?
- flow: is it a complete, self-contained thought/scene with a clear start and end?
- value: does it teach, surprise, or emotionally land (insight, punchline, revelation, conflict,
  a quotable line, or a concrete practical tip)?
- trend: would this feel relevant/shareable to a general audience today?

Return 5-8 candidate moments, ranked best first. Respond ONLY with JSON matching exactly:
{
  "videoTitle": string,
  "sourceIsHorizontal": boolean,
  "captionAudit": {
    "hasBurnedInText": boolean,
    "coveragePct": number (0-100, rough % of the runtime with burned-in text visible),
    "note": string (one sentence describing style/position/coverage, or "No burned-in text — clean footage." if none)
  },
  "clips": [
    {
      "startSec": number,
      "endSec": number,
      "rationale": string (one sentence, English, why this moment was picked),
      "hookHi": string (Hindi translation of the moment's key spoken line or a Hindi
        one-line hook summarizing it, written in Devanagari script),
      "scores": { "hook": number, "flow": number, "value": number, "trend": number },
      "reframe": {
        "focalX": number (0=left … 1=right; where the main subject sits horizontally in THIS clip),
        "focalY": number (0=top … 1=bottom; usually ~0.4 for a seated person's face),
        "subjectMoves": boolean (true if the subject crosses the frame during the clip),
        "note": string (one short phrase, e.g. "host seated left; keep focalX 0.35")
      }
    }
  ]
}
Include "reframe" ONLY when sourceIsHorizontal is true. No markdown fences, no commentary outside the JSON.`;

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  return JSON.parse(raw.trim());
}

function isPlausibleClip(c: unknown): c is CandidateClip {
  if (typeof c !== "object" || c === null) return false;
  const r = c as Record<string, unknown>;
  return (
    typeof r.startSec === "number" &&
    typeof r.endSec === "number" &&
    r.endSec > r.startSec &&
    typeof r.rationale === "string" &&
    typeof r.hookHi === "string" &&
    typeof r.scores === "object" &&
    r.scores !== null
  );
}

/**
 * Analyze a public YouTube video and return ranked candidate short-form clips.
 * Throws with a readable message on quota/permission/parse failures.
 */
export async function analyzeYouTubeVideo(opts: {
  url: string;
  apiKey: string;
  model?: string;
}): Promise<AnalyzeResult> {
  const model = opts.model ?? "gemini-3.5-flash";
  const res = await fetch("/api/gemini", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      apiKey: opts.apiKey,
      body: {
        contents: [
          {
            parts: [
              { fileData: { fileUri: opts.url } },
              { text: RUBRIC_PROMPT },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json" },
      },
    }),
  });
  const json = await res.json();
  if (json.error) {
    const msg = String(json.error.message || "");
    if (/quota|RESOURCE_EXHAUSTED/i.test(msg)) throw new Error("Gemini quota exceeded — try again later.");
    if (/PERMISSION_DENIED|API key/i.test(msg)) throw new Error("Gemini API key rejected — check Settings.");
    if (/not.*found|unlisted|private/i.test(msg)) {
      throw new Error("Video not accessible — only public YouTube videos can be analyzed.");
    }
    throw new Error(`Gemini error: ${msg || "unknown"}`);
  }
  const text = json.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text;
  if (!text) throw new Error("Gemini returned no analysis text.");

  let parsed: unknown;
  try {
    parsed = extractJson(text);
  } catch {
    throw new Error("Could not parse Gemini's response as JSON.");
  }
  const obj = parsed as {
    videoTitle?: unknown;
    sourceIsHorizontal?: unknown;
    captionAudit?: unknown;
    clips?: unknown;
  };
  if (typeof obj.videoTitle !== "string" || !Array.isArray(obj.clips)) {
    throw new Error("Gemini's response was missing videoTitle/clips.");
  }
  const clips: CandidateClip[] = obj.clips.filter(isPlausibleClip).map((c) => {
    const s = c.scores as { hook: number; flow: number; value: number; trend: number };
    const overall = Math.round((s.hook + s.flow + s.value + s.trend) / 4);
    return { ...c, overall, reframe: normalizeReframe((c as { reframe?: unknown }).reframe) };
  });
  clips.sort((a, b) => b.overall - a.overall);

  const sourceIsHorizontal =
    typeof obj.sourceIsHorizontal === "boolean"
      ? obj.sourceIsHorizontal
      : clips.some((c) => c.reframe !== undefined);

  const rawAudit = obj.captionAudit as Partial<CaptionAudit> | undefined;
  const captionAudit: CaptionAudit = {
    hasBurnedInText: typeof rawAudit?.hasBurnedInText === "boolean" ? rawAudit.hasBurnedInText : false,
    coveragePct:
      typeof rawAudit?.coveragePct === "number" ? Math.max(0, Math.min(100, rawAudit.coveragePct)) : 0,
    note: typeof rawAudit?.note === "string" ? rawAudit.note : "Caption audit unavailable for this video.",
  };

  return { videoTitle: obj.videoTitle, sourceIsHorizontal, captionAudit, clips };
}

/** Validate + clamp a raw reframe hint; returns undefined for vertical sources. */
function normalizeReframe(raw: unknown): ReframeHint | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const r = raw as Partial<ReframeHint>;
  const clamp01 = (n: unknown, fallback: number) =>
    typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
  return {
    focalX: clamp01(r.focalX, 0.5),
    focalY: clamp01(r.focalY, 0.5),
    subjectMoves: typeof r.subjectMoves === "boolean" ? r.subjectMoves : false,
    note: typeof r.note === "string" ? r.note : "",
  };
}


