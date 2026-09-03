import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, KeyRound, Mic, RefreshCw, Save, X } from "lucide-react";
import { loadSettings, saveSettings } from "../settings";
import { listVoices, synthesize, type Voice } from "../ai/elevenlabs";

// Voiceover panel — right drawer (same chrome as the template Library drawer):
// pick an ElevenLabs voice, write a script, synthesize, preview, then save the
// MP3 into public/voiceover (staticFile-servable for <Audio/> in comps).

const TTS_MODELS = [
  { id: "eleven_v3", label: "Eleven v3 — expressive (audio tags)" },
  { id: "eleven_multilingual_v2", label: "Multilingual v2 — stable narration" },
  { id: "eleven_turbo_v2_5", label: "Turbo v2.5 — fast, 32 languages" },
  { id: "eleven_flash_v2_5", label: "Flash v2.5 — fastest, low latency" },
];

/** Rough $ estimate per character (Creator-plan class pricing). */
const EST_USD_PER_CHAR = 0.00015;

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "voiceover"
  );
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

/** Read the ElevenLabs key without assuming the provider is in the ProviderId union yet. */
function getElevenLabsKey(): string {
  const keys = loadSettings().keys as Partial<Record<string, string>>;
  return (keys.elevenlabs ?? "").trim();
}

/** Tick up the estimated $ usage for the elevenlabs provider in Settings. */
function trackElevenLabsUsage(usd: number) {
  const s = loadSettings();
  const usage = s.usageUsd as Partial<Record<string, number>>;
  saveSettings({
    ...s,
    usageUsd: { ...s.usageUsd, elevenlabs: (usage.elevenlabs ?? 0) + usd } as typeof s.usageUsd,
  });
}

interface SavedFile {
  name: string;
  size: number;
}

interface VoiceoverPanelProps {
  open: boolean;
  onClose: () => void;
}

export const VoiceoverPanel: React.FC<VoiceoverPanelProps> = ({ open, onClose }) => {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voicesError, setVoicesError] = useState("");
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [voiceId, setVoiceId] = useState("");
  const [modelId, setModelId] = useState(TTS_MODELS[0].id);
  const [script, setScript] = useState("");
  const [busy, setBusy] = useState<"generating" | "saving" | null>(null);
  const [error, setError] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [savedName, setSavedName] = useState("");
  const [saved, setSaved] = useState<SavedFile[]>([]);
  const blobRef = useRef<Blob | null>(null);

  const apiKey = getElevenLabsKey();

  const refreshSaved = useCallback(async () => {
    try {
      const res = await fetch("/api/assets/list?subdir=voiceover");
      const j = (await res.json()) as { files?: SavedFile[] };
      setSaved(j.files ?? []);
    } catch {
      setSaved([]);
    }
  }, []);

  // Load the voice list once per open (cached in state afterwards).
  useEffect(() => {
    if (!open) return;
    void refreshSaved();
    if (!apiKey || voices.length > 0 || voicesLoading) return;
    setVoicesLoading(true);
    setVoicesError("");
    listVoices(apiKey)
      .then((v) => {
        setVoices(v);
        if (v.length > 0) setVoiceId((cur) => cur || v[0].voiceId);
      })
      .catch((e) => setVoicesError(e instanceof Error ? e.message : String(e)))
      .finally(() => setVoicesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, apiKey]);

  // Revoke the preview object URL when replaced.
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const handleGenerate = async () => {
    if (!apiKey || !voiceId || !script.trim() || busy) return;
    setBusy("generating");
    setError("");
    setSavedName("");
    try {
      const blob = await synthesize({ apiKey, voiceId, text: script.trim(), modelId });
      trackElevenLabsUsage(script.trim().length * EST_USD_PER_CHAR);
      blobRef.current = blob;
      setAudioUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const handleSave = async () => {
    const blob = blobRef.current;
    if (!blob || busy) return;
    setBusy("saving");
    setError("");
    try {
      const fileName = `${slugify(script)}-${Date.now()}.mp3`;
      const res = await fetch("/api/assets/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subdir: "voiceover", fileName, dataBase64: await blobToBase64(blob) }),
      });
      const j = (await res.json()) as { ok?: boolean; path?: string; error?: string };
      if (!res.ok || !j.ok || !j.path) throw new Error(j.error ?? `save failed (HTTP ${res.status})`);
      setSavedName(fileName);
      void refreshSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  if (!open) return null;

  const estUsd = script.trim().length * EST_USD_PER_CHAR;

  return (
    <aside className="library" style={{ width: 340, maxWidth: "92vw" }}>
      <div className="library-head">
        <span>Voiceover</span>
        <button className="library-x" onClick={onClose} aria-label="Close voiceover panel">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {!apiKey && (
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-[#e4e2dc] bg-[#1B1C20] p-3 text-xs text-[#9a99ab]">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-[#e84a6f]" />
            <span>
              Add your <b className="text-[#1a1a1f]">ElevenLabs</b> API key in Settings (gear button,
              bottom-left) to synthesize voiceovers.
            </span>
          </div>
        )}

        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#6b6a75]">
          Voice
        </label>
        <div className="flex items-center gap-2">
          <select
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            disabled={voices.length === 0}
            className="min-w-0 flex-1 rounded-lg border border-[#e4e2dc] bg-white px-2 py-1.5 text-xs text-[#1a1a1f] outline-none focus:border-[#e84a6f]/60 disabled:opacity-40"
          >
            {voices.length === 0 && <option value="">{voicesLoading ? "Loading voices…" : "No voices"}</option>}
            {voices.map((v) => {
              const tags = v.labels ? Object.values(v.labels).filter(Boolean).slice(0, 2).join(", ") : "";
              return (
                <option key={v.voiceId} value={v.voiceId}>
                  {v.name}
                  {tags ? ` — ${tags}` : ""}
                </option>
              );
            })}
          </select>
          <button
            className="inline-flex items-center rounded-md border border-[#e4e2dc] bg-[#f3f2ee] p-1.5 text-[#1a1a1f] transition-colors hover:bg-[#ebeae6] disabled:opacity-40"
            title="Reload voices"
            disabled={!apiKey || voicesLoading}
            onClick={() => {
              setVoices([]);
              setVoicesError("");
            }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${voicesLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
        {voicesError && <div className="mt-1 text-[11px] text-rose-300">{voicesError}</div>}

        <label className="mb-1 mt-3 block text-[11px] font-semibold uppercase tracking-wide text-[#6b6a75]">
          Model
        </label>
        <select
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          className="w-full rounded-lg border border-[#e4e2dc] bg-white px-2 py-1.5 text-xs text-[#1a1a1f] outline-none focus:border-[#e84a6f]/60"
        >
          {TTS_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        {modelId === "eleven_v3" && (
          <p className="mt-1.5 text-[11px] leading-relaxed text-[#6b6a75]">
            v3 tags: <span className="text-[#9a99ab]">[pause]</span>{" "}
            <span className="text-[#9a99ab]">[excited]</span>{" "}
            <span className="text-[#9a99ab]">[whispers]</span>{" "}
            <span className="text-[#9a99ab]">[sighs]</span>{" "}
            <span className="text-[#9a99ab]">[curious]</span> — plus ellipses … for weight.
          </p>
        )}

        <label className="mb-1 mt-3 block text-[11px] font-semibold uppercase tracking-wide text-[#6b6a75]">
          Script
        </label>
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder={
            modelId === "eleven_v3"
              ? "[excited] Your hook here… [pause] then the payoff."
              : "Write the narration — “Meet the team behind the magic…”"
          }
          rows={5}
          className="w-full resize-none rounded-lg border border-[#e4e2dc] bg-white px-3 py-2 text-sm text-[#1a1a1f] outline-none placeholder:text-[#6b6a75] focus:border-[#e84a6f]/60"
        />

        <button
          onClick={() => void handleGenerate()}
          disabled={!apiKey || !voiceId || !script.trim() || !!busy}
          className="render-btn mt-2 w-full justify-center disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === "generating" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
          {busy === "generating" ? "Synthesizing…" : `Generate (~$${estUsd.toFixed(2)})`}
        </button>

        {error && (
          <div className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-300">
            {error}
          </div>
        )}

        {audioUrl && (
          <div className="mt-3 rounded-xl border border-[#e4e2dc] bg-[#1B1C20] p-2">
            <audio controls src={audioUrl} className="w-full" style={{ height: 36 }} />
            <button
              onClick={() => void handleSave()}
              disabled={!!busy || !!savedName}
              className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-md border border-[#e4e2dc] bg-[#f3f2ee] px-2 py-1.5 text-xs text-[#1a1a1f] transition-colors hover:bg-[#ebeae6] disabled:opacity-40"
            >
              {savedName ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Save className="h-3.5 w-3.5" />}
              {busy === "saving" ? "Saving…" : savedName ? `Saved · ${savedName}` : "Save to public/voiceover"}
            </button>
          </div>
        )}

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#6b6a75]">
              Saved voiceovers
            </span>
            <button
              className="inline-flex items-center gap-1 rounded-md border border-[#e4e2dc] bg-[#f3f2ee] px-2 py-1 text-[11px] text-[#1a1a1f] transition-colors hover:bg-[#ebeae6]"
              onClick={() => void refreshSaved()}
            >
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
          </div>
          {saved.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#e4e2dc] p-4 text-center text-xs text-[#6b6a75]">
              Saved narrations appear here — use them via staticFile("voiceover/…")
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {saved.map((f) => (
                <div key={f.name} className="rounded-xl border border-[#e4e2dc] bg-[#1B1C20] p-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-[10.5px] text-[#9a99ab]" title={f.name}>
                      {f.name}
                    </span>
                    <span className="shrink-0 text-[10px] text-[#6b6a75]">{(f.size / 1024).toFixed(0)} KB</span>
                  </div>
                  <audio controls src={`/voiceover/${encodeURIComponent(f.name)}`} className="w-full" style={{ height: 32 }} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
