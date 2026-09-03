import React, { useEffect, useState } from "react";
import { X, Upload, Loader2, ExternalLink, AlertTriangle, ImageIcon } from "lucide-react";
import type { Settings } from "./settings";
import type { ChannelId } from "./channels";
import {
  getYouTubeOAuthCreds,
  hasYouTubeChannels,
  resolveYouTubeChannel,
} from "./youtubeChannels";
import { getYouTubePublishDefaults } from "./youtubePublishDefaults";
import { YouTubeChannelPicker } from "./YouTubeChannelPicker";
import { type YouTubePrivacy, listYouTubeRenders } from "./ai/youtube";
import {
  defaultRenderFilename,
  pickRenderForComp,
} from "./renderBinding";
import {
  defaultRenderSettingsForComp,
  renderAndPublish,
  type PublishProgress,
} from "./publishPipeline";
import { generateThumbnailForProject } from "./thumbnailGenerator";
import { recordProjectUpload } from "./youtubeUploads";

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  compId: string;
  projectId?: string;
  projectName?: string;
  folderId?: ChannelId;
  thumbSrc?: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  props: unknown;
  settings: Settings;
  onOpenSettings?: () => void;
}

export const UploadDialog: React.FC<UploadDialogProps> = ({
  open,
  onClose,
  compId,
  projectId,
  projectName,
  folderId,
  thumbSrc,
  width,
  height,
  fps,
  durationInFrames,
  props,
  settings: appSettings,
  onOpenSettings,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [privacy, setPrivacy] = useState<YouTubePrivacy>("unlisted");
  const [useExistingRender, setUseExistingRender] = useState(false);
  const [hasExistingRender, setHasExistingRender] = useState(false);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState<PublishProgress | null>(null);
  const [uploadUrl, setUploadUrl] = useState("");
  const [error, setError] = useState("");
  const [connectionId, setConnectionId] = useState("");

  const ytCreds = getYouTubeOAuthCreds(appSettings);
  const ytChannel = resolveYouTubeChannel(appSettings, {
    projectId,
    folderId,
    connectionId: connectionId || undefined,
  });
  const ytReady = hasYouTubeChannels(appSettings) && Boolean(ytChannel?.refreshToken && ytCreds.clientId);
  const isVertical = height > width;
  const busy = progress?.stage === "rendering" || progress?.stage === "uploading" || progress?.stage === "thumbnail";

  useEffect(() => {
    if (!open) return;
    const defaults = getYouTubePublishDefaults(compId, projectName);
    setTitle(defaults.title);
    setDescription(defaults.description);
    setTags(defaults.tags);
    setPrivacy("unlisted");
    setProgress(null);
    setUploadUrl("");
    setError("");
    setUseExistingRender(false);

    const resolved = resolveYouTubeChannel(appSettings, { projectId, folderId });
    setConnectionId(resolved?.id ?? "");

    void (async () => {
      try {
        const files = await listYouTubeRenders();
        const filename = pickRenderForComp(files, compId);
        const exists = files.some((f) => f.filename === filename);
        setHasExistingRender(exists);
        setUseExistingRender(exists);
      } catch {
        setHasExistingRender(false);
      }
    })();
  }, [open, compId, projectName, projectId, folderId, appSettings]);

  useEffect(() => {
    if (!open || !title.trim()) return;
    let cancelled = false;
    void (async () => {
      const thumb = await generateThumbnailForProject({
        title: title.trim(),
        thumbSrc: thumbSrc ? `/${thumbSrc.replace(/^\//, "")}` : undefined,
        isVertical,
        accent: "#FF3B6E",
        compId,
      });
      if (!cancelled) setThumbPreview(thumb?.dataUrl ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, title, thumbSrc, isVertical, compId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, busy]);

  if (!open) return null;

  const onUpload = async () => {
    if (!ytReady || !folderId) return;
    setError("");
    setUploadUrl("");
    const renderSettings = defaultRenderSettingsForComp(compId, width, height, fps, durationInFrames);
    try {
      const { url, videoId } = await renderAndPublish({
        settings: appSettings,
        target: {
          projectId: projectId ?? compId,
          projectName: projectName ?? title,
          compId,
          folderId: folderId!,
          thumbSrc,
          width,
          height,
          fps,
          durationInFrames,
          props,
        },
        title,
        description,
        tags,
        privacy,
        renderSettings,
        skipRender: useExistingRender && hasExistingRender,
        connectionId: connectionId || undefined,
        onProgress: setProgress,
      });
      const ytChannel = resolveYouTubeChannel(appSettings, {
        projectId: projectId ?? compId,
        folderId,
        connectionId: connectionId || undefined,
      });
      if (ytChannel && projectId) {
        recordProjectUpload({
          projectId,
          compId,
          videoId,
          url,
          title,
          channelConnectionId: ytChannel.id,
          youtubeChannelId: ytChannel.youtubeChannelId,
          privacy,
        });
      }
      setUploadUrl(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setProgress({ stage: "error", renderProgress: 0, message: msg, error: msg });
    }
  };

  const stageLabel =
    progress?.stage === "rendering"
      ? `Rendering… ${progress.renderProgress}%`
      : progress?.stage === "thumbnail"
        ? "Generating Shorts thumbnail…"
        : progress?.stage === "uploading"
          ? "Uploading to YouTube…"
          : progress?.stage === "done"
            ? "Done"
            : "";

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4" onClick={busy ? undefined : onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#2C2D31] bg-[#17181C] text-gray-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#2C2D31] px-5 py-4">
          <h2 className="text-base font-semibold">Upload to YouTube</h2>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-full bg-[#26272C] p-1.5 text-gray-300 transition-colors hover:bg-[#2E3033] hover:text-white disabled:opacity-40"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!ytReady ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              <p className="mb-2 flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Connect YouTube first
              </p>
              <p className="mb-3 text-amber-100/80">
                Link your Google account and assign a channel for this {folderId ? "folder or project" : "project"}.
              </p>
              {onOpenSettings ? (
                <button type="button" className="upload-connect-btn" onClick={onOpenSettings}>
                  Open YouTube settings
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <YouTubeChannelPicker
                settings={appSettings}
                projectId={projectId}
                folderId={folderId}
                value={connectionId}
                onValueChange={setConnectionId}
                label="Publish to"
                className="mb-4"
                disabled={busy}
              />

              <p className="mb-4 text-xs text-gray-400">
                Renders the video, generates a {isVertical ? "vertical Shorts" : ""} thumbnail, then uploads in one step.
              </p>

              {hasExistingRender ? (
                <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={useExistingRender}
                    onChange={(e) => setUseExistingRender(e.target.checked)}
                    disabled={busy}
                  />
                  Use latest render ({defaultRenderFilename(compId)}) — skip re-render
                </label>
              ) : null}

              <label className="mb-1 block text-xs font-medium text-gray-400">Title</label>
              <input
                className="mb-3 w-full rounded-lg border border-[#2C2D31] bg-[#1B1C20] px-3 py-2 text-sm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={busy}
              />

              <label className="mb-1 block text-xs font-medium text-gray-400">Description</label>
              <textarea
                className="mb-3 w-full rounded-lg border border-[#2C2D31] bg-[#1B1C20] px-3 py-2 text-sm"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={busy}
              />

              <label className="mb-1 block text-xs font-medium text-gray-400">Tags (comma-separated)</label>
              <input
                className="mb-3 w-full rounded-lg border border-[#2C2D31] bg-[#1B1C20] px-3 py-2 text-sm"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                disabled={busy}
              />

              <label className="mb-1 block text-xs font-medium text-gray-400">Privacy</label>
              <div className="mb-4 flex gap-2">
                {(["unlisted", "public", "private"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    disabled={busy}
                    onClick={() => setPrivacy(p)}
                    className={`rounded-lg border px-3 py-1.5 text-sm capitalize ${
                      privacy === p
                        ? "border-[#e84a6f] bg-[#e84a6f]/10 text-white"
                        : "border-[#2C2D31] bg-[#1B1C20] text-gray-400"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <label className="mb-2 flex items-center gap-2 text-xs font-medium text-gray-400">
                <ImageIcon className="h-3.5 w-3.5" />
                Thumbnail preview {isVertical ? "(9:16 Shorts)" : ""}
              </label>
              <div className="upload-thumb-preview mb-4" data-vertical={isVertical ? "true" : undefined}>
                {thumbPreview ? (
                  <img src={thumbPreview} alt="Thumbnail preview" />
                ) : (
                  <span className="text-xs text-gray-500">Generating preview…</span>
                )}
              </div>

              {busy && progress ? (
                <div className="mb-3">
                  <div className="mb-1 flex justify-between text-xs text-gray-400">
                    <span>{stageLabel}</span>
                    {progress.stage === "rendering" ? <span>{progress.renderProgress}%</span> : null}
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#2C2D31]">
                    <div
                      className="h-full bg-[#e84a6f] transition-all duration-300"
                      style={{
                        width: `${progress.stage === "rendering" ? progress.renderProgress : progress.stage === "done" ? 100 : 66}%`,
                      }}
                    />
                  </div>
                </div>
              ) : null}

              {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}

              {uploadUrl ? (
                <a
                  href={uploadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mb-3 inline-flex items-center gap-1.5 text-sm text-[#e84a6f] hover:underline"
                >
                  Open on YouTube <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[#2C2D31] px-5 py-4">
          <button type="button" className="upload-cancel-btn" onClick={onClose} disabled={busy}>
            {uploadUrl ? "Close" : "Cancel"}
          </button>
          {ytReady && !uploadUrl ? (
            <button type="button" className="upload-primary-btn" onClick={onUpload} disabled={busy || !title.trim()}>
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {stageLabel || "Working…"}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" /> Render &amp; Upload
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
