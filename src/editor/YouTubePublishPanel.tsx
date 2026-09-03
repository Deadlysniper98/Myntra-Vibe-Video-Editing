import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  ImagePlus,
  Loader2,
  RefreshCw,
  Upload,
  Video,
  AlertTriangle,
} from "lucide-react";
import type { Settings } from "./settings";
import type { ChannelId } from "./channels";
import {
  getYouTubeOAuthCreds,
  resolveYouTubeChannel,
} from "./youtubeChannels";
import { YouTubeChannelPicker } from "./YouTubeChannelPicker";
import {
  listYouTubeRenders,
  uploadToYouTube,
  type YouTubePrivacy,
  type YouTubeRenderFile,
} from "./ai/youtube";
import { getYouTubePublishDefaults } from "./youtubePublishDefaults";
import {
  loadThumbnailAssets,
  resolveThumbnailCatalog,
  type LoadedThumbnail,
} from "./youtubeThumbnailCatalog";
import {
  defaultRenderFilename,
  filterRendersForComp,
  pickRenderForComp,
} from "./renderBinding";

interface YouTubePublishPanelProps {
  settings: Settings;
  onChangeSettings?: (next: Settings) => void;
  compId: string;
  projectId?: string;
  folderId?: ChannelId;
  projectName?: string;
  onOpenRender?: () => void;
}

export const YouTubePublishPanel: React.FC<YouTubePublishPanelProps> = ({
  settings,
  onChangeSettings,
  compId,
  projectId,
  folderId,
  projectName,
  onOpenRender,
}) => {
  const ytCreds = getYouTubeOAuthCreds(settings);
  const channel = resolveYouTubeChannel(settings, { projectId, folderId });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [privacy, setPrivacy] = useState<YouTubePrivacy>("unlisted");
  const [filename, setFilename] = useState("");
  const [renders, setRenders] = useState<YouTubeRenderFile[]>([]);
  const [rendersLoading, setRendersLoading] = useState(false);
  const [thumbnails, setThumbnails] = useState<LoadedThumbnail[]>([]);
  const [thumbsLoading, setThumbsLoading] = useState(false);
  const [selectedThumb, setSelectedThumb] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadUrl, setUploadUrl] = useState("");
  const thumbFileInputRef = useRef<HTMLInputElement>(null);

  const refreshRenders = useCallback(async () => {
    setRendersLoading(true);
    try {
      const files = await listYouTubeRenders();
      setRenders(files);
      setFilename(pickRenderForComp(files, compId));
    } catch {
      setRenders([]);
      setFilename(defaultRenderFilename(compId));
    } finally {
      setRendersLoading(false);
    }
  }, [compId]);

  const loadThumbnails = useCallback(async () => {
    setThumbsLoading(true);
    try {
      const catalog = await resolveThumbnailCatalog(compId);
      const loaded = await loadThumbnailAssets(catalog);
      setThumbnails(loaded);
      setSelectedThumb((prev) => {
        if (prev && loaded.some((t) => t.id === prev)) return prev;
        return loaded[0]?.id ?? null;
      });
    } catch {
      setThumbnails([]);
      setSelectedThumb(null);
    } finally {
      setThumbsLoading(false);
    }
  }, [compId]);

  const onUploadThumbnailFile = useCallback(async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.readAsDataURL(file);
    });
    const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : "";
    if (!base64) return;
    const id = `custom-${Date.now()}`;
    setThumbnails((prev) => [
      { id, label: file.name || "Custom", src: dataUrl, dataUrl, pngBase64: base64 },
      ...prev,
    ]);
    setSelectedThumb(id);
  }, []);

  useEffect(() => {
    const defaults = getYouTubePublishDefaults(compId, projectName);
    setTitle(defaults.title);
    setDescription(defaults.description);
    setTags(defaults.tags);
    setUploadError("");
    setUploadUrl("");
    void refreshRenders();
    void loadThumbnails();
  }, [compId, projectName, refreshRenders, loadThumbnails]);

  const onPublish = async () => {
    if (!channel?.refreshToken || !ytCreds.clientId || !ytCreds.clientSecret) return;
    if (!filename.trim()) {
      setUploadError("Choose a rendered video file.");
      return;
    }
    const thumb = thumbnails.find((t) => t.id === selectedThumb);
    setUploading(true);
    setUploadError("");
    setUploadUrl("");
    try {
      const result = await uploadToYouTube({
        clientId: ytCreds.clientId,
        clientSecret: ytCreds.clientSecret,
        refreshToken: channel.refreshToken,
        filename: filename.trim(),
        title: title.trim() || filename,
        description,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        privacyStatus: privacy,
        thumbnailPngBase64: thumb?.pngBase64,
      });
      setUploadUrl(result.url || result.studioUrl || "");
      if (result.thumbnailWarning) {
        setUploadError(`Video uploaded, but thumbnail failed: ${result.thumbnailWarning}`);
      }
    } catch (e) {
      setUploadError(String(e instanceof Error ? e.message : e));
    } finally {
      setUploading(false);
    }
  };

  const selectedRender = renders.find((r) => r.filename === filename);
  const hasRender = Boolean(selectedRender);
  const compRenders = filterRendersForComp(renders, compId);
  const compLabel = projectName ?? compId.replace(/([A-Z])/g, " $1").trim();

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line-soft)" }} className="ds-stack">
      <div>
        <h4 className="ds-section-title" style={{ marginBottom: 4, fontSize: "var(--text-sm)" }}>Publish to YouTube</h4>
        <p className="ds-muted">
          Publishing <b style={{ color: "var(--ink-2)" }}>{compLabel}</b> — only renders for this video are shown.
        </p>
      </div>

      {onChangeSettings && projectId ? (
        <YouTubeChannelPicker
          settings={settings}
          onChange={onChangeSettings}
          projectId={projectId}
          folderId={folderId}
          label="YouTube channel for this project"
        />
      ) : null}

      <div className="ds-card">
        <div className="ds-row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <label className="ds-label" style={{ margin: 0 }}>
            Rendered video <span className="ds-muted" style={{ fontFamily: "ui-monospace, monospace" }}>({compId})</span>
          </label>
          <button
            type="button"
            onClick={() => void refreshRenders()}
            disabled={rendersLoading}
            className="ds-btn ds-btn--ghost"
            style={{ fontSize: "var(--text-2xs)", padding: "2px 6px" }}
          >
            <RefreshCw className={`h-3 w-3 ${rendersLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        {compRenders.length === 0 ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
            No render for this video in <code className="text-amber-100">out/</code> (expected{" "}
            <code className="text-amber-100">{defaultRenderFilename(compId)}</code> or similar).{" "}
            {onOpenRender ? (
              <button type="button" onClick={onOpenRender} className="underline hover:text-white">
                Render this video first
              </button>
            ) : (
              "Use the Render button in the editor first."
            )}
          </div>
        ) : (
          <select
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className="ds-field"
          >
            {compRenders.map((r) => (
              <option key={r.filename} value={r.filename}>
                {r.filename} ({r.sizeMb} MB)
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="ds-stack">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Video title" className="ds-field" />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description with chapters"
          rows={7}
          className="ds-field"
          style={{ resize: "vertical" }}
        />
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags — comma separated" className="ds-field" />
        <div className="ds-row">
          {(["unlisted", "private", "public"] as YouTubePrivacy[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPrivacy(p)}
              className="ds-pill-btn"
              data-active={privacy === p}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[#2C2D31] bg-[#1B1C20] p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-gray-300">Thumbnail options</p>
            <p className="text-[10px] text-gray-500">Click to select — refreshed from project assets</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <input
              ref={thumbFileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onUploadThumbnailFile(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => thumbFileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-[#e4e2dc] px-2.5 py-1 text-[10px] text-gray-500 hover:text-gray-800"
            >
              <ImagePlus className="h-3 w-3" />
              Upload
            </button>
            <button
              type="button"
              onClick={() => void loadThumbnails()}
              disabled={thumbsLoading}
              className="flex items-center gap-1.5 rounded-lg border border-[#e4e2dc] px-2.5 py-1 text-[10px] text-gray-400 hover:text-gray-200 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${thumbsLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {thumbsLoading ? (
          <div className="grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex aspect-video items-center justify-center rounded-lg border border-[#e4e2dc] bg-white"
              >
                <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
              </div>
            ))}
          </div>
        ) : thumbnails.length > 0 ? (
          <div className="max-h-[min(520px,55vh)] overflow-y-auto pr-1">
            <p className="mb-2 text-[10px] text-gray-500">{thumbnails.length} options — scroll to review all</p>
            <div className="grid grid-cols-2 gap-2">
            {thumbnails.map((t) => {
              const selected = selectedThumb === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedThumb(t.id)}
                  className={`group relative overflow-hidden rounded-lg border-2 text-left transition-colors ${
                    selected ? "border-[#e84a6f] ring-2 ring-[#e84a6f]/25" : "border-[#e4e2dc] hover:border-gray-300"
                  }`}
                >
                  <img src={t.dataUrl} alt={t.label} className="aspect-video w-full object-cover" />
                  <span
                    className={`absolute bottom-0 left-0 right-0 px-2 py-1 text-[10px] font-medium ${
                      selected ? "bg-[#e84a6f]/90 text-white" : "bg-black/60 text-gray-200"
                    }`}
                  >
                    {selected ? "✓ " : ""}
                    {t.label}
                  </span>
                </button>
              );
            })}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[#e4e2dc] px-3 py-4 text-center text-[11px] text-gray-500">
            No thumbnails in <code className="text-gray-400">public/generated/youtube-thumbnails/</code> yet.
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => void onPublish()}
        disabled={uploading || !hasRender}
        className="flex items-center justify-center gap-2 rounded-lg bg-red-600/90 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {uploading ? "Uploading…" : "Publish to YouTube"}
      </button>

      {!hasRender && compRenders.length > 0 ? (
        <p className="flex items-center gap-1 text-[11px] text-amber-300/90">
          <AlertTriangle className="h-3 w-3" /> Select a rendered file above.
        </p>
      ) : null}

      {uploadUrl ? (
        <a
          href={uploadUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-1.5 text-xs text-emerald-300 hover:underline"
        >
          <Video className="h-3.5 w-3.5" /> Open on YouTube <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}

      {uploadError ? <p className="text-[11px] text-rose-400">{uploadError}</p> : null}
    </div>
  );
};


