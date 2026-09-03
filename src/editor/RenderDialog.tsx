import React, { useEffect, useRef, useState } from "react";
import { X, Download, Copy, Check, Loader2, AlertTriangle, Video, ExternalLink } from "lucide-react";
import {
  RENDER_FORMATS,
  formatOf,
  startRender,
  getRenderStatus,
  buildCliCommand,
  type RenderSettings,
  type RenderJob,
} from "./render";
import type { Settings } from "./settings";
import type { ChannelId } from "./channels";
import {
  getYouTubeOAuthCreds,
  hasYouTubeChannels,
  resolveYouTubeChannel,
} from "./youtubeChannels";
import { uploadToYouTube, type YouTubePrivacy } from "./ai/youtube";
import { getYouTubePublishDefaults } from "./youtubePublishDefaults";
import {
  defaultRenderFilename,
  saveLastRenderForComp,
} from "./renderBinding";

interface RenderDialogProps {
  open: boolean;
  onClose: () => void;
  compId: string;
  projectId?: string;
  projectName?: string;
  folderId?: ChannelId;
  width: number;
  height: number;
  fps: number; // composition's native fps
  durationInFrames: number;
  props: unknown;
  settings: Settings;
  onOpenSettings?: () => void;
}

function getResolutionPresets(width: number, height: number) {
  const aspect = width / height;
  if (aspect >= 2.0) {
    // Ultrawide (21:9 or wider) — use UW-specific labels and scale steps
    return [
      { scale: 0.5, label: "HD UW",  dims: `${Math.round(width * 0.5)}×${Math.round(height * 0.5)}` },
      { scale: 1.0, label: "WFHD",   dims: `${width}×${height}` },
      { scale: 2.0, label: "4K UW",  dims: `${width * 2}×${height * 2}` },
    ];
  }
  // Standard aspect ratios (16:9, 9:16, 1:1) — scale relative to shorter dim
  const minDim = Math.min(width, height);
  const s = (p: number) => p / minDim;
  return [
    { scale: s(720),  label: "720p",  dims: `${Math.round(width * s(720))}×${Math.round(height * s(720))}` },
    { scale: s(1080), label: "1080p", dims: `${Math.round(width * s(1080))}×${Math.round(height * s(1080))}` },
    { scale: s(2160), label: "4K",    dims: `${Math.round(width * s(2160))}×${Math.round(height * s(2160))}` },
  ];
}
const FPS_OPTIONS = [24, 30, 60];

const timecode = (frame: number, fps: number) => {
  const t = Math.max(0, frame) / fps;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export const RenderDialog: React.FC<RenderDialogProps> = ({
  open,
  onClose,
  compId,
  projectId,
  projectName,
  folderId,
  width,
  height,
  fps,
  durationInFrames,
  props,
  settings: appSettings,
  onOpenSettings,
}) => {
  const minDim = Math.min(width, height);
  const scaleFor = (p: number) => p / minDim;

  const [settings, setSettings] = useState<RenderSettings>({
    formatId: "mp4-h264",
    crf: 18,
    resolution: 1080,
    scale: scaleFor(1080),
    fps,
    startFrame: 0,
    endFrame: durationInFrames - 1,
    filename: defaultRenderFilename(compId),
  });
  const [job, setJob] = useState<RenderJob>({ status: "idle", progress: 0, output: "", error: "" });
  const [copied, setCopied] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadTags, setUploadTags] = useState("");
  const [uploadPrivacy, setUploadPrivacy] = useState<YouTubePrivacy>("unlisted");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadUrl, setUploadUrl] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const ytCreds = getYouTubeOAuthCreds(appSettings);
  const ytChannel = resolveYouTubeChannel(appSettings, { projectId, folderId });
  const ytReady = hasYouTubeChannels(appSettings) && Boolean(ytChannel?.refreshToken && ytCreds.clientId);

  useEffect(() => {
    if (open) {
      setSettings((s) => ({ ...s, startFrame: 0, endFrame: durationInFrames - 1, fps }));
      const publishDefaults = getYouTubePublishDefaults(compId, projectName);
      setUploadTitle(publishDefaults.title);
      setUploadDesc(publishDefaults.description);
      setUploadTags(publishDefaults.tags);
      setUploadError("");
      setUploadUrl("");
    }
  }, [open, durationInFrames, fps, compId, projectName]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  useEffect(() => {
    if (job.status === "done" && settings.filename) {
      saveLastRenderForComp(compId, settings.filename);
    }
  }, [job.status, compId, settings.filename]);

  if (!open) return null;

  const fmt = formatOf(settings.formatId);
  const set = (patch: Partial<RenderSettings>) => setSettings((s) => ({ ...s, ...patch }));
  const onFormat = (id: string) => {
    const f = formatOf(id);
    set({ formatId: id, filename: settings.filename.replace(/\.[^.]+$/, "") + "." + f.ext });
  };

  const frameCount = Math.max(0, settings.endFrame - settings.startFrame + 1);
  const seconds = (frameCount / settings.fps).toFixed(1);
  const rendering = job.status === "rendering";

  const onRender = async () => {
    setJob({ status: "rendering", progress: 0, output: "", error: "" });
    try {
      const id = await startRender(compId, settings, props);
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        const s = await getRenderStatus(id);
        setJob(s);
        if (s.status === "done" || s.status === "error") {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }, 1000);
    } catch (e) {
      setJob({ status: "error", progress: 0, output: "", error: String(e) });
    }
  };

  const copyCli = async () => {
    try {
      await navigator.clipboard.writeText(buildCliCommand(compId, settings, props));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  const onUploadYouTube = async () => {
    if (!ytChannel?.refreshToken || !ytCreds.clientId || !ytCreds.clientSecret) return;
    setUploading(true);
    setUploadError("");
    setUploadUrl("");
    try {
      const result = await uploadToYouTube({
        clientId: ytCreds.clientId,
        clientSecret: ytCreds.clientSecret,
        refreshToken: ytChannel.refreshToken,
        filename: settings.filename,
        title: uploadTitle.trim() || settings.filename,
        description: uploadDesc,
        privacyStatus: uploadPrivacy,
        tags: uploadTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      setUploadUrl(result.url || result.studioUrl || "");
    } catch (e) {
      setUploadError(String(e instanceof Error ? e.message : e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="ds-overlay" onClick={onClose}>
      <div
        className="ds-dialog ds-dialog--stack ds-dialog--md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ds-dialog-header">
          <h2 className="ds-section-title">Render</h2>
          <button type="button" onClick={onClose} className="ds-dialog-close" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="ds-dialog-body" style={{ flex: 1 }}>
          <label className="ds-label">Format</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            {RENDER_FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onFormat(f.id)}
                className="ds-pill-btn"
                data-active={settings.formatId === f.id}
              >
                {f.label}
              </button>
            ))}
          </div>

          <label className="ds-label">Resolution</label>
          <div className="ds-row" style={{ marginBottom: 16, flexWrap: "wrap" }}>
            {getResolutionPresets(width, height).map((r) => (
              <button
                key={r.label}
                type="button"
                onClick={() => set({ resolution: Math.round(Math.min(width, height) * r.scale), scale: r.scale })}
                className="ds-pill-btn"
                data-active={Math.abs(settings.scale - r.scale) < 0.01}
              >
                <span style={{ display: "block", lineHeight: 1.3 }}>{r.label}</span>
                <span style={{ display: "block", fontFamily: "ui-monospace, monospace", fontSize: "var(--text-2xs)", opacity: 0.65 }}>
                  {r.dims}
                </span>
              </button>
            ))}
          </div>

          <label className="ds-label">Frame rate</label>
          <div className="ds-row" style={{ marginBottom: 4 }}>
            {FPS_OPTIONS.map((f) => (
              <button key={f} type="button" onClick={() => set({ fps: f })} className="ds-pill-btn" data-active={settings.fps === f}>
                {f} fps
              </button>
            ))}
          </div>
          {settings.fps !== fps ? (
            <p className="ds-muted" style={{ marginBottom: 16, color: "var(--warn)" }}>
              This promo is authored at {fps}fps — other rates change its playback speed.
            </p>
          ) : (
            <div style={{ marginBottom: 16 }} />
          )}

          {fmt.video && (
            <div style={{ marginBottom: 16 }}>
              <div className="ds-row" style={{ justifyContent: "space-between", marginBottom: 4, fontSize: "var(--text-xs)" }}>
                <span className="ds-label" style={{ margin: 0 }}>Quality (CRF)</span>
                <span style={{ color: "var(--ink-2)" }}>
                  {settings.crf} · {settings.crf <= 18 ? "high" : settings.crf <= 28 ? "balanced" : "small file"}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={45}
                value={settings.crf}
                onChange={(e) => set({ crf: Number(e.target.value) })}
                className="ui-range w-full"
                style={{ ["--fill" as string]: `${((settings.crf - 1) / 44) * 100}%` } as React.CSSProperties}
              />
            </div>
          )}

          <div className="ds-row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
            <label className="ds-label" style={{ margin: 0 }}>
              Range <span className="ds-muted">· {frameCount} frames · {seconds}s</span>
            </label>
            <button
              type="button"
              onClick={() => set({ startFrame: 0, endFrame: durationInFrames - 1 })}
              className="ds-btn ds-btn--ghost"
              style={{ fontSize: "var(--text-xs)", padding: "2px 6px" }}
            >
              Full clip
            </button>
          </div>
          <div className="ds-row" style={{ marginBottom: 16, flexWrap: "wrap" }}>
            <div>
              <input
                type="number"
                min={0}
                max={durationInFrames - 1}
                value={settings.startFrame}
                onChange={(e) => set({ startFrame: Math.max(0, Math.min(settings.endFrame, Number(e.target.value))) })}
                className="ds-field"
                style={{ width: 96 }}
              />
              <span className="ds-muted" style={{ display: "block", marginTop: 4, fontFamily: "ui-monospace, monospace" }}>
                start · {timecode(settings.startFrame, settings.fps)}
              </span>
            </div>
            <span className="ds-muted">→</span>
            <div>
              <input
                type="number"
                min={0}
                max={durationInFrames - 1}
                value={settings.endFrame}
                onChange={(e) => set({ endFrame: Math.min(durationInFrames - 1, Math.max(settings.startFrame, Number(e.target.value))) })}
                className="ds-field"
                style={{ width: 96 }}
              />
              <span className="ds-muted" style={{ display: "block", marginTop: 4, fontFamily: "ui-monospace, monospace" }}>
                end · {timecode(settings.endFrame, settings.fps)}
              </span>
            </div>
            <span className="ds-muted" style={{ marginLeft: "auto" }}>of {durationInFrames}f</span>
          </div>

          <label className="ds-label">Output file</label>
          <input
            value={settings.filename}
            onChange={(e) => set({ filename: e.target.value })}
            className="ds-field ds-field--mono"
            style={{ marginBottom: 8 }}
          />
          <div className="ds-muted">Saved to the project’s <code>out/</code> folder.</div>

          {job.status !== "idle" && (
            <div className="ds-card" style={{ marginTop: 16 }}>
              {rendering && (
                <>
                  <div className="ds-row" style={{ marginBottom: 8, fontSize: "var(--text-sm)" }}>
                    <Loader2 className="h-4 w-4 animate-spin" /> Rendering… {job.progress}%
                  </div>
                  <div className="ds-progress-track">
                    <div className="ds-progress-fill" style={{ width: `${job.progress}%` }} />
                  </div>
                  <p className="ds-muted" style={{ marginTop: 8 }}>
                    First render downloads a headless Chromium — that one can take a minute.
                  </p>
                </>
              )}
              {job.status === "done" && (
                <>
                  <a
                    href={job.output}
                    download
                    className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500/15 py-2 text-sm font-medium text-emerald-300"
                  >
                    <Download className="h-4 w-4" /> Download {settings.filename}
                  </a>
                  {fmt.video ? (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line-soft)" }}>
                      <div className="ds-row ds-muted" style={{ marginBottom: 8, fontWeight: 600, color: "var(--ink-2)" }}>
                        <Video className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} /> Publish to YouTube
                      </div>
                      {!ytReady ? (
                        <button type="button" onClick={onOpenSettings} className="ds-btn" style={{ width: "100%" }}>
                          Connect YouTube in Settings →
                        </button>
                      ) : (
                        <div className="ds-stack">
                          <input
                            value={uploadTitle}
                            onChange={(e) => setUploadTitle(e.target.value)}
                            placeholder="Video title"
                            className="ds-field"
                          />
                          <textarea
                            value={uploadDesc}
                            onChange={(e) => setUploadDesc(e.target.value)}
                            placeholder="Description — chapters, links, credits"
                            rows={6}
                            className="ds-field"
                            style={{ resize: "vertical" }}
                          />
                          <input
                            value={uploadTags}
                            onChange={(e) => setUploadTags(e.target.value)}
                            placeholder="Tags — comma separated"
                            className="ds-field"
                          />
                          <p className="ds-muted">
                            Edit title, description, tags, and privacy before upload. YouTube chapters go in the
                            description as timestamps (e.g. 0:00 Intro).
                          </p>
                          <div className="ds-row">
                            {(["unlisted", "private", "public"] as YouTubePrivacy[]).map((p) => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setUploadPrivacy(p)}
                                className="ds-pill-btn"
                                data-active={uploadPrivacy === p}
                              >
                                {p}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={onUploadYouTube}
                            disabled={uploading}
                            className="ds-btn ds-btn--accent"
                            style={{ width: "100%" }}
                          >
                            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                            {uploading ? "Uploading…" : "Upload to channel"}
                          </button>
                          {uploadUrl ? (
                            <a
                              href={uploadUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="ds-link"
                              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: "var(--success)" }}
                            >
                              Open in YouTube <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : null}
                          {uploadError ? (
                            <p className="ds-muted" style={{ color: "var(--danger)" }}>{uploadError}</p>
                          ) : null}
                        </div>
                      )}
                    </div>
                  ) : null}
                </>
              )}
              {job.status === "error" && (
                <div className="flex items-start gap-2 text-sm text-rose-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed">{job.error}</pre>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-[#2C2D31] px-5 py-4">
          <button
            onClick={copyCli}
            className="flex items-center gap-1.5 rounded-lg border border-[#e4e2dc] px-3 py-2 text-xs text-gray-500 transition-colors hover:text-gray-800"
            title="Copy the equivalent CLI command"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy CLI"}
          </button>
          <div className="flex-1" />
          <button
            onClick={onRender}
            disabled={rendering}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#ff5c7a] to-[#ff8c6b] px-5 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
          >
            {rendering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {rendering ? "Rendering…" : "Render"}
          </button>
        </div>
      </div>
    </div>
  );
};


