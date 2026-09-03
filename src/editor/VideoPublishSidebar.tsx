import React, { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Download,
  ExternalLink,
  FolderOpen,
  ImageIcon,
  Loader2,
  Upload,
  AlertTriangle,
} from "lucide-react";
import type { Settings } from "./settings";
import type { ChannelId } from "./channels";
import type { Project } from "./projects";
import {
  getYouTubeOAuthCreds,
  getYouTubeChannels,
  hasYouTubeChannels,
  resolveYouTubeChannel,
} from "./youtubeChannels";
import { YouTubeChannelMultiPicker } from "./YouTubeChannelMultiPicker";
import { YouTubeChannelActions } from "./YouTubeChannelActions";
import { getYouTubePublishDefaults } from "./youtubePublishDefaults";
import { type YouTubePrivacy, listYouTubeRenders, revealRenderInExplorer } from "./ai/youtube";
import {
  defaultRenderFilename,
  pickRenderForComp,
} from "./renderBinding";
import {
  defaultRenderSettingsForComp,
  type PublishProgress,
} from "./publishPipeline";
import { generateThumbnailForProject } from "./thumbnailGenerator";
import { resolveThumbnailCatalog, loadThumbnailAssets, type LoadedThumbnail } from "./youtubeThumbnailCatalog";
import { getUploadsForProject } from "./youtubeUploads";
import { publishJobQueue } from "./publishJobQueue";
import { useProjectPublishJob } from "./usePublishJobs";

interface VideoPublishSidebarProps {
  settings: Settings;
  onChangeSettings: (next: Settings) => void;
  compId: string;
  projectId: string;
  projectName?: string;
  folderId?: ChannelId;
  thumbSrc?: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  props: unknown;
  onOpenRender: () => void;
  onOpenSettings?: () => void;
  prevProject?: Project | null;
  nextProject?: Project | null;
  navIndex: number;
  navTotal: number;
  onPrev?: () => void;
  onNext?: () => void;
}

export const VideoPublishSidebar: React.FC<VideoPublishSidebarProps> = ({
  settings,
  onChangeSettings,
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
  onOpenRender,
  onOpenSettings,
  prevProject,
  nextProject,
  navIndex,
  navTotal,
  onPrev,
  onNext,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [privacy, setPrivacy] = useState<YouTubePrivacy>("unlisted");
  const [hasExistingRender, setHasExistingRender] = useState(false);
  const [renderFilename, setRenderFilename] = useState<string | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [thumbSource, setThumbSource] = useState<"ai" | "canvas">("ai");
  const [selectedAiThumbId, setSelectedAiThumbId] = useState<string | null>(null);
  const [aiThumbs, setAiThumbs] = useState<LoadedThumbnail[]>([]);
  const [canvasThumb, setCanvasThumb] = useState<LoadedThumbnail | null>(null);
  const [progress, setProgress] = useState<PublishProgress | null>(null);
  const [uploadUrls, setUploadUrls] = useState<{ id: string; title: string; url: string }[]>([]);
  const [connectionIds, setConnectionIds] = useState<string[]>([]);
  const [channelsOpen, setChannelsOpen] = useState(false);
  const [error, setError] = useState("");

  const activeJob = useProjectPublishJob(projectId);
  const jobRunning = activeJob?.status === "running";
  const jobProgress = jobRunning ? activeJob.progress : progress;

  const ytCreds = getYouTubeOAuthCreds(settings);
  const existingUploads = getUploadsForProject(projectId);
  const uploadedChannelIds = existingUploads.map((u) => u.channelConnectionId);
  const uploadedChannelSet = new Set(uploadedChannelIds);
  const ytReady =
    hasYouTubeChannels(settings) &&
    Boolean(ytCreds.clientId) &&
    connectionIds.length > 0 &&
    connectionIds.every((id) => resolveYouTubeChannel(settings, { connectionId: id })?.refreshToken);
  const isVertical = height > width;
  const busy =
    jobRunning ||
    jobProgress?.stage === "rendering" ||
    jobProgress?.stage === "uploading" ||
    jobProgress?.stage === "thumbnail";

  useEffect(() => {
    const defaults = getYouTubePublishDefaults(compId, projectName);
    setTitle(defaults.title);
    setDescription(defaults.description);
    setTags(defaults.tags);
    setPrivacy("unlisted");
    setProgress(null);
    setUploadUrls([]);
    setError("");
    setRenderFilename(null);

    const defaultCh = resolveYouTubeChannel(settings, { projectId, folderId });
    const all = getYouTubeChannels(settings);
    const uploaded = new Set(getUploadsForProject(projectId).map((u) => u.channelConnectionId));
    const preferFresh = all.filter((c) => !uploaded.has(c.id));
    if (defaultCh && !uploaded.has(defaultCh.id)) {
      setConnectionIds([defaultCh.id]);
    } else if (preferFresh.length > 0) {
      setConnectionIds([preferFresh[0].id]);
    } else if (defaultCh) {
      setConnectionIds([defaultCh.id]);
    } else {
      setConnectionIds(all[0] ? [all[0].id] : []);
    }

    void (async () => {
      try {
        const files = await listYouTubeRenders();
        const filename = pickRenderForComp(files, compId);
        const exists = files.some((f) => f.filename === filename);
        setHasExistingRender(exists);
        setRenderFilename(exists ? filename : null);
      } catch {
        setHasExistingRender(false);
        setRenderFilename(null);
      }
    })();
  }, [compId, projectName, projectId, folderId, settings]);

  useEffect(() => {
    if (!activeJob) return;
    if (activeJob.status === "running") {
      setProgress(activeJob.progress);
      return;
    }
    if (activeJob.status === "done" && activeJob.results.length > 0) {
      setUploadUrls(activeJob.results);
      setProgress(activeJob.progress);
    }
    if (activeJob.status === "error") {
      if (activeJob.progress.error) setError(activeJob.progress.error);
      if (activeJob.results.length > 0) setUploadUrls(activeJob.results);
      setProgress(activeJob.progress);
    }
  }, [activeJob]);

  useEffect(() => {
    if (!title.trim()) return;
    let cancelled = false;
    void (async () => {
      const catalog = await resolveThumbnailCatalog(compId);
      const loaded = catalog.length > 0 ? await loadThumbnailAssets(catalog) : [];
      const canvas = await generateThumbnailForProject({
        title: title.trim(),
        thumbSrc: thumbSrc ? `/${thumbSrc.replace(/^\//, "")}` : undefined,
        isVertical,
        accent: "#FF3B6E",
        compId,
        forceCanvas: true,
      });
      if (cancelled) return;
      setAiThumbs(loaded);
      if (canvas) {
        setCanvasThumb({
          id: "canvas",
          label: "Auto hook text",
          src: "",
          dataUrl: canvas.dataUrl,
          pngBase64: canvas.pngBase64,
        });
      } else {
        setCanvasThumb(null);
      }
      const useAi = loaded.length > 0;
      setThumbSource(useAi ? "ai" : "canvas");
      const firstAi = loaded[0] ?? null;
      setSelectedAiThumbId(firstAi?.id ?? null);
      setThumbPreview(useAi ? firstAi!.dataUrl : canvas?.dataUrl ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [title, thumbSrc, isVertical, compId]);

  const selectedAiThumb = aiThumbs.find((t) => t.id === selectedAiThumbId) ?? aiThumbs[0];

  const selectedThumbBase64 = (): string | undefined => {
    if (thumbSource === "canvas" && canvasThumb) return canvasThumb.pngBase64;
    return selectedAiThumb?.pngBase64;
  };

  const pickThumbSource = (source: "ai" | "canvas") => {
    setThumbSource(source);
    if (source === "ai" && selectedAiThumb) setThumbPreview(selectedAiThumb.dataUrl);
    else if (source === "canvas" && canvasThumb) setThumbPreview(canvasThumb.dataUrl);
  };

  const pickAiThumb = (id: string) => {
    const thumb = aiThumbs.find((t) => t.id === id);
    if (!thumb) return;
    setSelectedAiThumbId(id);
    setThumbSource("ai");
    setThumbPreview(thumb.dataUrl);
  };

  const onUpload = () => {
    if (!ytReady || !folderId || connectionIds.length === 0) return;
    setError("");
    setUploadUrls([]);
    const renderSettings = defaultRenderSettingsForComp(compId, width, height, fps, durationInFrames);
    const thumbBase64 = selectedThumbBase64();
    publishJobQueue.startPublish({
      settings,
      target: {
        projectId,
        projectName: projectName ?? title,
        compId,
        folderId,
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
      connectionIds,
      renderSettings,
      skipRenderForFirst: hasExistingRender,
      thumbnailPngBase64: thumbBase64,
    });
  };

  const selectedChannelLabels = connectionIds
    .map((id) => getYouTubeChannels(settings).find((c) => c.id === id)?.channelTitle)
    .filter(Boolean) as string[];
  const channelSummary = (() => {
    if (selectedChannelLabels.length === 0) return "Select channels";
    if (selectedChannelLabels.length === 1) {
      const id = connectionIds[0];
      const name = selectedChannelLabels[0];
      return uploadedChannelSet.has(id) ? `${name} · uploaded` : name;
    }
    const uploadedCount = connectionIds.filter((id) => uploadedChannelSet.has(id)).length;
    if (uploadedCount > 0) {
      return `${selectedChannelLabels[0]} +${selectedChannelLabels.length - 1} · ${uploadedCount} uploaded`;
    }
    return `${selectedChannelLabels[0]} +${selectedChannelLabels.length - 1}`;
  })();

  const stageLabel =
    jobProgress?.stage === "rendering"
      ? `Rendering… ${jobProgress.renderProgress}%`
      : jobProgress?.stage === "thumbnail"
        ? "Generating thumbnail…"
        : jobProgress?.stage === "uploading"
          ? "Uploading…"
          : jobProgress?.stage === "done"
            ? "Done"
            : "";

  const renderFile = hasExistingRender ? (renderFilename ?? defaultRenderFilename(compId)) : null;
  const primaryUpload = existingUploads[0];

  const onRevealExplorer = async () => {
    if (!renderFile) return;
    setError("");
    try {
      await revealRenderInExplorer(renderFile);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <aside className="publish-sidebar">
      {navTotal > 1 ? (
        <div className="publish-nav">
          <button
            type="button"
            className="publish-nav-btn"
            onClick={onPrev}
            disabled={!prevProject}
            title={prevProject ? `Previous: ${prevProject.name}` : "No previous video"}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="publish-nav-label">Previous</span>
          </button>
          <span className="publish-nav-count">
            {navIndex + 1} / {navTotal}
          </span>
          <button
            type="button"
            className="publish-nav-btn"
            onClick={onNext}
            disabled={!nextProject}
            title={nextProject ? `Next: ${nextProject.name}` : "No next video"}
          >
            <span className="publish-nav-label">Next</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <h4 className="publish-sidebar-title">Upload to YouTube</h4>

      {existingUploads.length > 0 ? (
        <div className="publish-yt-uploaded">
          <p className="publish-yt-uploaded-head">
            <ExternalLink className="h-4 w-4 shrink-0" />
            On YouTube ({existingUploads.length} channel{existingUploads.length === 1 ? "" : "s"})
          </p>
          <ul className="publish-yt-uploaded-list">
            {existingUploads.map((u) => {
              const ch = getYouTubeChannels(settings).find((c) => c.id === u.channelConnectionId);
              return (
                <li key={u.channelConnectionId}>
                  <a href={u.url} target="_blank" rel="noreferrer" className="publish-yt-uploaded-link">
                    {ch?.channelTitle ?? "YouTube"} · {u.privacy ?? "unlisted"}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {!hasYouTubeChannels(settings) ? (
        <div className="publish-yt-warn">
          <p className="publish-yt-warn-head">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Connect a YouTube channel
          </p>
          <p className="publish-yt-warn-text">
            Create a channel on YouTube (same Google account), then link it here to publish Shorts.
          </p>
          <YouTubeChannelActions
            settings={settings}
            onChange={onChangeSettings}
            onNeedCredentials={onOpenSettings}
            showSteps={false}
            linkVariant="primary"
          />
        </div>
      ) : (
        <>
          <div className="publish-channels-collapse">
            <button
              type="button"
              className="publish-channels-toggle"
              onClick={() => setChannelsOpen((o) => !o)}
              aria-expanded={channelsOpen}
              disabled={busy}
            >
              <ChevronDown className={`publish-channels-chevron${channelsOpen ? " publish-channels-chevron--open" : ""}`} />
              <span className="publish-channels-toggle-label">Publish to</span>
              <span className="publish-channels-toggle-value">{channelSummary}</span>
            </button>
            {channelsOpen ? (
              <YouTubeChannelMultiPicker
                settings={settings}
                values={connectionIds}
                onValuesChange={setConnectionIds}
                onChange={onChangeSettings}
                onNeedCredentials={onOpenSettings}
                uploadedChannelIds={uploadedChannelIds}
                label=""
                hint="Channels marked “Already uploaded” are on YouTube — select again to re-upload."
                className="publish-channel-picker publish-channel-picker--nested"
                disabled={busy}
              />
            ) : null}
          </div>

          {hasExistingRender ? (
            <p className="publish-render-ready">
              Render ready — <span className="publish-render-ready-name">{renderFile}</span>
            </p>
          ) : null}

          <label className="publish-field-label">Title</label>
          <input
            className="publish-field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
          />

          <label className="publish-field-label">Description</label>
          <textarea
            className="publish-field publish-field--area"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={busy}
          />

          <label className="publish-field-label">Tags (comma-separated)</label>
          <input
            className="publish-field"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            disabled={busy}
          />

          <label className="publish-field-label">Privacy</label>
          <div className="publish-privacy-row">
            {(["unlisted", "public", "private"] as const).map((p) => (
              <button
                key={p}
                type="button"
                disabled={busy}
                onClick={() => setPrivacy(p)}
                className="publish-privacy-btn"
                data-active={privacy === p ? "true" : undefined}
              >
                {p}
              </button>
            ))}
          </div>

          <label className="publish-field-label publish-field-label--icon">
            <ImageIcon className="h-3.5 w-3.5" />
            Thumbnail {isVertical ? "(9:16)" : ""}
          </label>
          {aiThumbs.length > 0 || canvasThumb ? (
            <div className="publish-thumb-tabs">
              {aiThumbs.length > 0 ? (
                <button
                  type="button"
                  className="publish-thumb-tab"
                  data-active={thumbSource === "ai" ? "true" : undefined}
                  onClick={() => pickThumbSource("ai")}
                >
                  AI generated
                </button>
              ) : null}
              {canvasThumb ? (
                <button
                  type="button"
                  className="publish-thumb-tab"
                  data-active={thumbSource === "canvas" ? "true" : undefined}
                  onClick={() => pickThumbSource("canvas")}
                >
                  Hook text overlay
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="upload-thumb-preview publish-thumb-preview" data-vertical={isVertical ? "true" : undefined}>
            {thumbPreview ? (
              <img src={thumbPreview} alt="Thumbnail preview" />
            ) : (
              <span className="publish-thumb-placeholder">Generating preview…</span>
            )}
          </div>
          {thumbSource === "ai" && aiThumbs.length > 1 ? (
            <div className="publish-thumb-picker">
              <p className="publish-thumb-picker-label">{aiThumbs.length} AI options — scroll to review</p>
              <div className="publish-thumb-picker-grid">
                {aiThumbs.map((t) => {
                  const selected = selectedAiThumbId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className="publish-thumb-picker-item"
                      data-selected={selected ? "true" : undefined}
                      onClick={() => pickAiThumb(t.id)}
                      title={t.label}
                    >
                      <img src={t.dataUrl} alt={t.label} />
                      <span>{selected ? "✓ " : ""}{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {busy && jobProgress ? (
            <div className="publish-progress">
              <div className="publish-progress-head">
                <span>{stageLabel}</span>
                {jobProgress.stage === "rendering" ? <span>{jobProgress.renderProgress}%</span> : null}
              </div>
              <div className="publish-progress-bar">
                <div
                  className="publish-progress-fill"
                  style={{
                    width: `${jobProgress.stage === "rendering" ? jobProgress.renderProgress : jobProgress.stage === "done" ? 100 : 66}%`,
                  }}
                />
              </div>
            </div>
          ) : null}

          {error ? <p className="publish-error">{error}</p> : null}

          {uploadUrls.length > 0 ? (
            <ul className="publish-yt-uploaded-list publish-yt-uploaded-list--fresh">
              {uploadUrls.map((u) => (
                <li key={u.id}>
                  <a href={u.url} target="_blank" rel="noreferrer" className="publish-yt-link">
                    {u.title} <ExternalLink className="h-3.5 w-3.5 inline" />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}

      <div className="publish-actions">
        {renderFile ? (
          <button
            type="button"
            className="publish-render-btn"
            onClick={() => void onRevealExplorer()}
            disabled={busy}
          >
            <FolderOpen className="h-4 w-4" /> Open in Explorer
          </button>
        ) : (
          <button type="button" className="publish-render-btn" onClick={onOpenRender} disabled={busy}>
            <Download className="h-4 w-4" /> Render
          </button>
        )}
        {ytReady ? (
          busy ? (
            <button type="button" className="upload-primary-btn publish-upload-btn" disabled>
              <Loader2 className="h-4 w-4 animate-spin" /> {stageLabel || "Working…"}
            </button>
          ) : primaryUpload ? (
            <a
              className="upload-primary-btn publish-upload-btn publish-action-link"
              href={primaryUpload.url}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="h-4 w-4" /> Open on YouTube
            </a>
          ) : renderFile ? (
            <button
              type="button"
              className="upload-primary-btn publish-upload-btn"
              onClick={onUpload}
              disabled={!title.trim() || connectionIds.length === 0}
            >
              <Upload className="h-4 w-4" />{" "}
              {connectionIds.length > 1 ? `Upload (${connectionIds.length})` : "Upload"}
            </button>
          ) : (
            <button
              type="button"
              className="upload-primary-btn publish-upload-btn"
              onClick={onUpload}
              disabled={!title.trim() || connectionIds.length === 0}
            >
              <Upload className="h-4 w-4" />{" "}
              {connectionIds.length > 1
                ? `Render & Upload (${connectionIds.length})`
                : "Render & Upload"}
            </button>
          )
        ) : null}
        {ytReady && primaryUpload && !busy ? (
          <button
            type="button"
            className="publish-upload-again"
            onClick={() => void onUpload()}
            disabled={!title.trim() || connectionIds.length === 0}
          >
            Upload again
          </button>
        ) : null}
      </div>
    </aside>
  );
};
