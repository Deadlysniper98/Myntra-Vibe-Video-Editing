import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, Image as ImageIcon, KeyRound, RefreshCw, Save, Scissors, Sparkles, X } from "lucide-react";
import { loadSettings, saveSettings } from "../settings";
import { fetchReferenceImages, generateImages, visionReview, type VisionReviewResult } from "../ai/gemini";
import { ART_STYLES, DEFAULT_ART_STYLE_ID, getArtStyle } from "../ai/artStyles";
import { removeBg } from "./bgRemoval";
import { analyzeImageBlob, type AssetQAReport } from "./qa";

// AI Asset Studio — right drawer (same chrome as the template Library drawer):
// prompt → art-style template → Gemini image generation → background removal →
// deterministic + vision QA → save into public/generated (staticFile-servable).
// Art styles live in ../ai/artStyles.ts, reverse-engineered from curated
// reference images.

const STYLE_GROUPS = Array.from(new Set(ART_STYLES.map((s) => s.group)));

/** Rough $ estimate per generated image (Nano Banana Pro class pricing). */
const EST_USD_PER_IMAGE = 0.13;
/** Rough $ estimate per vision review call. */
const EST_USD_PER_REVIEW = 0.01;

const QA_RUBRIC = [
  "This image must work as a cut-out overlay asset in a video infographic:",
  "1. Single clear subject, no clutter, no text or watermarks.",
  "2. Background must be a plain solid color (or already transparent).",
  "3. Crisp edges, flat-vector look, consistent palette.",
  "4. Subject centered with margin on every side, not touching the edges.",
].join("\n");

interface StudioImage {
  id: number;
  originalB64: string;
  originalMime: string;
  removedB64?: string;
  qa?: AssetQAReport;
  qaTarget?: "original" | "removed";
  vision?: VisionReviewResult;
  busy?: "removing" | "qa" | "saving" | null;
  savedPath?: string;
  error?: string;
}

interface LibraryFile {
  name: string;
  size: number;
}

function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("failed to read blob"));
    reader.onload = () => {
      const url = String(reader.result ?? "");
      resolve(url.slice(url.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "asset"
  );
}

/** Tick up the estimated $ usage for the Google provider in Settings. */
function trackGoogleUsage(usd: number) {
  const s = loadSettings();
  saveSettings({ ...s, usageUsd: { ...s.usageUsd, google: (s.usageUsd.google ?? 0) + usd } });
}

function buildPrompt(subject: string, styleId: string): string {
  return getArtStyle(styleId).buildPrompt(subject);
}

const QABadge: React.FC<{ passes: boolean }> = ({ passes }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
      passes ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
    }`}
  >
    {passes ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
    {passes ? "PASS" : "FAIL"}
  </span>
);

const QACard: React.FC<{ qa: AssetQAReport; target: string; vision?: VisionReviewResult }> = ({
  qa,
  target,
  vision,
}) => (
  <div className="mt-2 rounded-lg border border-[#e4e2dc] bg-white p-2 text-[11.5px] leading-relaxed text-[#6b6a75]">
    <div className="flex items-center justify-between">
      <span className="font-semibold text-[#1a1a1f]">QA · {target}</span>
      <QABadge passes={qa.passes && (vision ? vision.score >= 60 : true)} />
    </div>
    <div className="mt-1 grid grid-cols-2 gap-x-3">
      <span>alpha {qa.alphaCoveragePct}%</span>
      <span>halo {qa.edgeHaloScore}</span>
      <span>
        {qa.width}×{qa.height}
      </span>
      {vision && <span>vision score {vision.score}/100</span>}
    </div>
    {vision && <div className="mt-1 italic">“{vision.verdict}”</div>}
    {(qa.issues.length > 0 || (vision?.issues.length ?? 0) > 0) && (
      <ul className="mt-1 list-disc pl-4">
        {qa.issues.map((s, i) => (
          <li key={`d${i}`}>{s}</li>
        ))}
        {vision?.issues.map((s, i) => (
          <li key={`v${i}`}>{s}</li>
        ))}
      </ul>
    )}
    {vision && vision.suggestions.length > 0 && (
      <div className="mt-1 text-[#6b6a75]">Try: {vision.suggestions.join(" · ")}</div>
    )}
  </div>
);

interface AssetStudioProps {
  open: boolean;
  onClose: () => void;
}

export const AssetStudio: React.FC<AssetStudioProps> = ({ open, onClose }) => {
  const [tab, setTab] = useState<"create" | "library">("create");
  const [prompt, setPrompt] = useState("");
  const [preset, setPreset] = useState<string>(DEFAULT_ART_STYLE_ID);
  const [count, setCount] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [globalError, setGlobalError] = useState("");
  const [images, setImages] = useState<StudioImage[]>([]);
  const [libFiles, setLibFiles] = useState<LibraryFile[]>([]);
  const nextId = useRef(1);

  const geminiKey = (loadSettings().keys.google ?? "").trim();

  const patchImage = useCallback((id: number, patch: Partial<StudioImage>) => {
    setImages((prev) => prev.map((im) => (im.id === id ? { ...im, ...patch } : im)));
  }, []);

  const refreshLibrary = useCallback(async () => {
    try {
      const res = await fetch("/api/assets/list?subdir=generated");
      const j = (await res.json()) as { files?: LibraryFile[] };
      setLibFiles(j.files ?? []);
    } catch {
      setLibFiles([]);
    }
  }, []);

  useEffect(() => {
    if (open && tab === "library") void refreshLibrary();
  }, [open, tab, refreshLibrary]);

  // Deterministic QA runs automatically after every generation and every
  // background removal — this is the pipeline's built-in testing system.
  const runDeterministicQA = useCallback(
    async (id: number, b64: string, mime: string, target: "original" | "removed") => {
      try {
        const qa = await analyzeImageBlob(base64ToBlob(b64, mime));
        patchImage(id, { qa, qaTarget: target });
      } catch (e) {
        patchImage(id, { error: `QA failed: ${e instanceof Error ? e.message : String(e)}` });
      }
    },
    [patchImage],
  );

  const handleGenerate = async () => {
    if (!prompt.trim() || generating || !geminiKey) return;
    setGenerating(true);
    setGlobalError("");
    try {
      const style = getArtStyle(preset);
      const referenceImages = style.referenceImagePaths?.length
        ? await fetchReferenceImages(style.referenceImagePaths)
        : undefined;
      const results = await generateImages({
        prompt: buildPrompt(prompt.trim(), preset),
        apiKey: geminiKey,
        count,
        referenceImages,
      });
      trackGoogleUsage(results.length * EST_USD_PER_IMAGE);
      const fresh: StudioImage[] = results.map((r) => ({
        id: nextId.current++,
        originalB64: r.pngBase64,
        originalMime: r.mimeType,
      }));
      setImages((prev) => [...fresh, ...prev]);
      for (const im of fresh) {
        void runDeterministicQA(im.id, im.originalB64, im.originalMime, "original");
      }
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  const handleRemoveBg = async (im: StudioImage) => {
    patchImage(im.id, { busy: "removing", error: "" });
    try {
      const removed = await removeBg(base64ToBlob(im.originalB64, im.originalMime));
      const removedB64 = await blobToBase64(removed);
      patchImage(im.id, { removedB64, busy: null });
      await runDeterministicQA(im.id, removedB64, "image/png", "removed");
    } catch (e) {
      patchImage(im.id, { busy: null, error: e instanceof Error ? e.message : String(e) });
    }
  };

  const handleQA = async (im: StudioImage) => {
    const target: "original" | "removed" = im.removedB64 ? "removed" : "original";
    const b64 = im.removedB64 ?? im.originalB64;
    const mime = im.removedB64 ? "image/png" : im.originalMime;
    patchImage(im.id, { busy: "qa", error: "" });
    try {
      const qa = await analyzeImageBlob(base64ToBlob(b64, mime));
      let vision: VisionReviewResult | undefined;
      if (geminiKey) {
        vision = await visionReview({ pngBase64: b64, rubric: QA_RUBRIC, apiKey: geminiKey });
        trackGoogleUsage(EST_USD_PER_REVIEW);
      }
      patchImage(im.id, { qa, qaTarget: target, vision, busy: null });
    } catch (e) {
      patchImage(im.id, { busy: null, error: e instanceof Error ? e.message : String(e) });
    }
  };

  const handleSave = async (im: StudioImage) => {
    const b64 = im.removedB64 ?? im.originalB64;
    patchImage(im.id, { busy: "saving", error: "" });
    try {
      const fileName = `${slugify(prompt)}-${im.id}-${Date.now()}.png`;
      const res = await fetch("/api/assets/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subdir: "generated", fileName, dataBase64: b64 }),
      });
      const j = (await res.json()) as { ok?: boolean; path?: string; error?: string };
      if (!res.ok || !j.ok || !j.path) throw new Error(j.error ?? `save failed (HTTP ${res.status})`);
      patchImage(im.id, { busy: null, savedPath: j.path });
      void refreshLibrary();
    } catch (e) {
      patchImage(im.id, { busy: null, error: e instanceof Error ? e.message : String(e) });
    }
  };

  if (!open) return null;

  const actBtn =
    "inline-flex items-center gap-1 rounded-md border border-[#e4e2dc] bg-[#f3f2ee] px-2 py-1 text-[11.5px] text-[#1a1a1f] transition-colors hover:bg-[#ebeae6] disabled:opacity-40";

  return (
    <aside className="library" style={{ width: 380, maxWidth: "92vw" }}>
      <div className="library-head">
        <span>Asset Studio</span>
        <button className="library-x" onClick={onClose} aria-label="Close asset studio">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex gap-1 border-b border-[#efede8] px-3 py-2">
        {(["create", "library"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition-colors ${
              tab === t ? "bg-[#f3f2ee] text-white" : "text-[#6b6a75] hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "create" && (
          <>
            {!geminiKey && (
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-[#e4e2dc] bg-[#1B1C20] p-3 text-xs text-[#6b6a75]">
                <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-[#e84a6f]" />
                <span>
                  Add your <b className="text-[#1a1a1f]">Google · Gemini</b> API key in Settings (gear
                  button, bottom-left) to generate assets.
                </span>
              </div>
            )}

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the asset — “a rocket lifting off”, “a gold trophy”…"
              rows={3}
              className="w-full resize-none rounded-lg border border-[#e4e2dc] bg-white px-3 py-2 text-sm text-[#1a1a1f] outline-none placeholder:text-[#6b6a75] focus:border-[#e84a6f]/60"
            />

            <div className="mt-2 flex items-center gap-2">
              <select
                value={preset}
                onChange={(e) => setPreset(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-[#e4e2dc] bg-white px-2 py-1.5 text-xs text-[#1a1a1f] outline-none focus:border-[#e84a6f]/60"
              >
                {STYLE_GROUPS.map((g) => (
                  <optgroup key={g} label={g}>
                    {ART_STYLES.filter((s) => s.group === g).map((s) => (
                      <option key={s.id} value={s.id} title={s.tagline}>
                        {s.label}
                        {s.referenceImagePaths?.length ? " ✦ ref-matched" : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="rounded-lg border border-[#e4e2dc] bg-white px-2 py-1.5 text-xs text-[#1a1a1f] outline-none focus:border-[#e84a6f]/60"
                title="Number of images"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    ×{n}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => void handleGenerate()}
              disabled={!prompt.trim() || generating || !geminiKey}
              className="render-btn mt-2 w-full justify-center disabled:cursor-not-allowed disabled:opacity-40"
            >
              {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? "Generating…" : `Generate (~$${(count * EST_USD_PER_IMAGE).toFixed(2)})`}
            </button>

            {globalError && (
              <div className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-300">
                {globalError}
              </div>
            )}

            <div className="mt-3 flex flex-col gap-3">
              {images.map((im) => (
                <div key={im.id} className="rounded-xl border border-[#e4e2dc] bg-[#1B1C20] p-2">
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 text-[10px] uppercase tracking-wide text-[#6b6a75]">original</div>
                      <img
                        src={`data:${im.originalMime};base64,${im.originalB64}`}
                        alt="generated asset"
                        className="w-full rounded-lg border border-[#efede8] bg-white"
                      />
                    </div>
                    {im.removedB64 && (
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 text-[10px] uppercase tracking-wide text-[#6b6a75]">bg removed</div>
                        <img
                          src={`data:image/png;base64,${im.removedB64}`}
                          alt="asset with background removed"
                          className="w-full rounded-lg border border-[#efede8]"
                          style={{
                            background:
                              "repeating-conic-gradient(#ebeae6 0% 25%, #f5f4f0 0% 50%) 0 0 / 14px 14px",
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <button className={actBtn} disabled={!!im.busy} onClick={() => void handleRemoveBg(im)}>
                      <Scissors className="h-3 w-3" />
                      {im.busy === "removing" ? "Removing…" : im.removedB64 ? "Re-run BG" : "Remove BG"}
                    </button>
                    <button className={actBtn} disabled={!!im.busy} onClick={() => void handleQA(im)}>
                      <RefreshCw className={`h-3 w-3 ${im.busy === "qa" ? "animate-spin" : ""}`} />
                      QA
                    </button>
                    <button
                      className={actBtn}
                      disabled={!!im.busy || !!im.savedPath}
                      onClick={() => void handleSave(im)}
                    >
                      {im.savedPath ? <Check className="h-3 w-3 text-emerald-400" /> : <Save className="h-3 w-3" />}
                      {im.busy === "saving" ? "Saving…" : im.savedPath ? "Saved" : "Save to Library"}
                    </button>
                  </div>

                  {im.savedPath && (
                    <div className="mt-1 font-mono text-[10.5px] text-emerald-400/80">public/{im.savedPath}</div>
                  )}
                  {im.error && <div className="mt-1 text-[11px] text-rose-300">{im.error}</div>}
                  {im.qa && <QACard qa={im.qa} target={im.qaTarget ?? "original"} vision={im.vision} />}
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "library" && (
          <>
            <div className="mb-2 flex items-center justify-between text-xs text-[#6b6a75]">
              <span>
                {libFiles.length} asset{libFiles.length === 1 ? "" : "s"} in public/generated
              </span>
              <button className={actBtn} onClick={() => void refreshLibrary()}>
                <RefreshCw className="h-3 w-3" /> Refresh
              </button>
            </div>
            {libFiles.length === 0 ? (
              <div className="grid place-items-center rounded-xl border border-dashed border-[#e4e2dc] p-6 text-xs text-[#6b6a75]">
                <ImageIcon className="mb-2 h-5 w-5" />
                Saved assets appear here — use them via staticFile("generated/…")
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {libFiles.map((f) => (
                  <div key={f.name} className="rounded-xl border border-[#e4e2dc] bg-[#1B1C20] p-1.5">
                    <img
                      src={`/generated/${encodeURIComponent(f.name)}`}
                      alt={f.name}
                      className="aspect-square w-full rounded-lg object-contain"
                      style={{
                        background:
                          "repeating-conic-gradient(#ebeae6 0% 25%, #f5f4f0 0% 50%) 0 0 / 14px 14px",
                      }}
                    />
                    <div className="mt-1 truncate font-mono text-[10px] text-[#6b6a75]" title={f.name}>
                      {f.name}
                    </div>
                    <div className="text-[10px] text-[#6b6a75]">{(f.size / 1024).toFixed(0)} KB</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
};
