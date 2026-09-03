import React, { useEffect, useRef, useState } from "react";
import {
  X,
  Upload,
  Loader2,
  Check,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Minimize2,
  Trash2,
} from "lucide-react";
import type { Settings } from "./settings";
import type { Project } from "./projects";
import { hasYouTubeChannels } from "./youtubeChannels";
import { YouTubeChannelMultiPicker } from "./YouTubeChannelMultiPicker";
import {
  bulkUploadQueue,
  type BulkUploadItemDraft,
} from "./bulkUploadQueue";
import { useBulkUploadQueue } from "./useBulkUploadQueue";
import { projectThumbUrl, formatDuration } from "./projectMeta";
import { generateThumbnailForProject } from "./thumbnailGenerator";
import { listYouTubeRenders } from "./ai/youtube";
import {
  buildProjectPublishSnapshot,
  type RenderFileInfo,
} from "./projectPublishStatus";
import { PublishStatusPills } from "./PublishStatusPills";

interface BulkUploadDialogProps {
  open: boolean;
  onClose: () => void;
  jobId: string | null;
  projects?: Project[];
  settings: Settings;
  onChangeSettings?: (next: Settings) => void;
  onOpenSettings?: () => void;
}

function stageLabel(item: BulkUploadItemDraft): string {
  if (item.status === "done") return `Uploaded · ${item.privacy}`;
  if (item.status === "error") return item.error?.slice(0, 80) ?? "Failed";
  if (item.status === "active" && item.stage === "rendering") {
    return `Rendering… ${item.progress}%`;
  }
  return item.message;
}

const BulkItemRow: React.FC<{
  item: BulkUploadItemDraft;
  project?: Project;
  settings: Settings;
  defaultConnectionIds: string[];
  renderFiles: RenderFileInfo[];
  editable: boolean;
  removable: boolean;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onChangeSettings?: (next: Settings) => void;
  onOpenSettings?: () => void;
  onChange: (
    patch: Partial<
      Pick<BulkUploadItemDraft, "title" | "description" | "tags" | "privacy" | "connectionIds">
    >,
  ) => void;
}> = ({
  item,
  project,
  settings,
  defaultConnectionIds,
  renderFiles,
  editable,
  removable,
  expanded,
  onToggle,
  onRemove,
  onChangeSettings,
  onOpenSettings,
  onChange,
}) => {
  const thumbSrc = projectThumbUrl({
    id: item.projectId,
    name: item.projectName,
    folderId: item.folderId as Project["folderId"],
    thumbSrc: item.thumbSrc,
    clips: [],
  });
  const channelIds = item.connectionIds?.length ? item.connectionIds : defaultConnectionIds;
  const hasChannelOverride = Boolean(item.connectionIds?.length);

  const [thumbPreview, setThumbPreview] = useState<string | null>(null);

  const snapshot = project
    ? buildProjectPublishSnapshot(project, renderFiles)
    : buildProjectPublishSnapshot(
        {
          id: item.projectId,
          name: item.projectName,
          folderId: item.folderId as Project["folderId"],
          compositionId: item.compId,
          thumbSrc: item.thumbSrc,
          clips: [],
        },
        renderFiles,
      );

  if (item.status === "done") {
    snapshot.youtubeUploaded = true;
    snapshot.youtubePrivacy = item.privacy;
    snapshot.youtubeUrl = item.url;
  }

  useEffect(() => {
    if (!expanded || !item.title.trim()) return;
    let cancelled = false;
    void (async () => {
      const thumb = await generateThumbnailForProject({
        title: item.title.trim(),
        thumbSrc: item.thumbSrc ? `/${item.thumbSrc.replace(/^\//, "")}` : undefined,
        isVertical: item.isVertical,
      });
      if (!cancelled) setThumbPreview(thumb?.dataUrl ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [expanded, item.title, item.thumbSrc, item.isVertical]);

  return (
    <li
      className={`bulk-upload-item bulk-upload-item--rich${expanded ? " bulk-upload-item--expanded" : ""}`}
      data-status={item.status}
    >
      <div className="bulk-upload-item-head">
        <button
          type="button"
          className="bulk-upload-item-expand"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        {thumbSrc ? (
          <img
            src={thumbSrc}
            alt=""
            className="bulk-upload-item-thumb"
            data-vertical={item.isVertical ? "true" : undefined}
          />
        ) : (
          <span className="bulk-upload-item-thumb bulk-upload-item-thumb--empty" />
        )}

        <div className="bulk-upload-item-main">
          <button type="button" className="bulk-upload-item-body" onClick={onToggle}>
            <span className="bulk-upload-item-name">{item.title || item.projectName}</span>
            <span className="bulk-upload-item-sub">
              {item.aspect}
              {item.durationSec != null ? ` · ${formatDuration(item.durationSec)}` : null}
              {item.isVertical ? " · Short" : ""}
              {channelIds.length > 1 ? ` · ${channelIds.length} channels` : null}
              {hasChannelOverride ? " · custom channels" : null}
            </span>
          </button>

          <PublishStatusPills snapshot={snapshot} settings={settings} />

          {item.status !== "pending" ? (
            <p className={`bulk-upload-item-progress bulk-upload-item-progress--${item.status}`}>
              {item.status === "active" ? (
                <Loader2 className="h-3 w-3 animate-spin inline" />
              ) : item.status === "done" ? (
                <Check className="h-3 w-3 inline" />
              ) : item.status === "error" ? (
                <AlertTriangle className="h-3 w-3 inline" />
              ) : null}{" "}
              {stageLabel(item)}
            </p>
          ) : null}
        </div>

        <div className="bulk-upload-item-actions">
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              title="Open on YouTube"
              className="bulk-upload-item-link"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : null}
          {removable ? (
            <button
              type="button"
              className="bulk-upload-item-remove"
              onClick={onRemove}
              title="Remove from batch"
              aria-label="Remove from batch"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div className="bulk-upload-item-detail">
          <div className="bulk-upload-item-fields">
            <label className="bulk-upload-field">
              <span>Title</span>
              <input
                value={item.title}
                disabled={!editable}
                onChange={(e) => onChange({ title: e.target.value })}
              />
            </label>
            <label className="bulk-upload-field">
              <span>Description</span>
              <textarea
                rows={4}
                value={item.description}
                disabled={!editable}
                onChange={(e) => onChange({ description: e.target.value })}
              />
            </label>
            <label className="bulk-upload-field">
              <span>Tags (comma-separated)</span>
              <input
                value={item.tags}
                disabled={!editable}
                onChange={(e) => onChange({ tags: e.target.value })}
              />
            </label>
            <label className="bulk-upload-field">
              <span>Channels</span>
              <YouTubeChannelMultiPicker
                settings={settings}
                values={channelIds}
                onValuesChange={(ids) => onChange({ connectionIds: ids })}
                onChange={onChangeSettings}
                onNeedCredentials={onOpenSettings}
                label=""
                hint={
                  hasChannelOverride
                    ? "Custom for this video only. Matches batch default if you select the same channels."
                    : "Uses batch default. Change here to override this video only."
                }
                disabled={!editable}
                showNames={false}
              />
            </label>
            <label className="bulk-upload-field">
              <span>Privacy</span>
              <div className="bulk-upload-privacy-row">
                {(["unlisted", "public", "private"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    disabled={!editable}
                    data-active={item.privacy === p ? "true" : undefined}
                    onClick={() => onChange({ privacy: p })}
                    className="bulk-upload-privacy-btn"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </label>
          </div>
          <div className="bulk-upload-item-preview">
            <span className="bulk-upload-preview-label">Thumbnail preview</span>
            <div className="upload-thumb-preview" data-vertical={item.isVertical ? "true" : undefined}>
              {thumbPreview ? <img src={thumbPreview} alt="" /> : <span className="bulk-upload-thumb-placeholder">…</span>}
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
};

export const BulkUploadDialog: React.FC<BulkUploadDialogProps> = ({
  open,
  onClose,
  jobId: jobIdProp,
  projects,
  settings,
  onChangeSettings,
  onOpenSettings,
}) => {
  const jobs = useBulkUploadQueue();
  const [localJobId, setLocalJobId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [defaultPrivacy, setDefaultPrivacy] = useState<"unlisted" | "public" | "private">("unlisted");
  const [renderFiles, setRenderFiles] = useState<RenderFileInfo[]>([]);
  const openedRef = useRef(false);

  const jobId = jobIdProp ?? localJobId;
  const job = jobId ? jobs.find((j) => j.id === jobId) : undefined;
  const ytReady = hasYouTubeChannels(settings);
  const isDraft = job?.status === "draft";
  const isRunning = job?.status === "running" || job?.status === "queued";

  const projectById = new Map((projects ?? []).map((p) => [p.id, p]));

  useEffect(() => {
    if (!open) {
      openedRef.current = false;
      if (!jobIdProp) setLocalJobId(null);
      return;
    }
    if (jobIdProp) {
      setLocalJobId(jobIdProp);
      openedRef.current = true;
      return;
    }
    if (openedRef.current) return;
    openedRef.current = true;

    if (projects && projects.length > 0) {
      const id = bulkUploadQueue.createDraft(projects, settings, defaultPrivacy);
      setLocalJobId(id);
      setExpandedIds(new Set());
    }
  }, [open, jobIdProp, projects, settings, defaultPrivacy]);

  useEffect(() => {
    if (!open) return;
    void listYouTubeRenders()
      .then((files) => setRenderFiles(files))
      .catch(() => setRenderFiles([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !job) return null;

  const toggleExpanded = (projectId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const expandAll = () => setExpandedIds(new Set(job.items.map((it) => it.projectId)));
  const collapseAll = () => setExpandedIds(new Set());

  const removeItem = (projectId: string) => {
    if (!jobId) return;
    bulkUploadQueue.removeItem(jobId, projectId);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.delete(projectId);
      return next;
    });
    const updated = bulkUploadQueue.getJob(jobId);
    if (!updated || updated.items.length === 0 || updated.status === "cancelled") {
      onClose();
    }
  };

  const startUpload = () => {
    if (!jobId) return;
    bulkUploadQueue.startJob(jobId);
  };

  const applyPrivacyAll = (privacy: typeof defaultPrivacy) => {
    setDefaultPrivacy(privacy);
    if (jobId && isDraft) bulkUploadQueue.setJobPrivacy(jobId, privacy);
  };

  const doneCount = job.items.filter((i) => i.status === "done").length;
  const errorCount = job.items.filter((i) => i.status === "error").length;
  const editable = isDraft;
  const allExpanded = job.items.length > 0 && job.items.every((it) => expandedIds.has(it.projectId));

  return (
    <div className="bulk-upload-overlay" onClick={onClose}>
      <div className="bulk-upload-dialog" onClick={(e) => e.stopPropagation()}>
        <header className="bulk-upload-dialog-header">
          <div>
            <h2 className="bulk-upload-dialog-title">{job.label}</h2>
            <p className="bulk-upload-dialog-sub">
              {isDraft
                ? "Review metadata before uploading. Remove any video you do not want in this batch."
                : isRunning
                  ? "Running in background — you can close this and keep working."
                  : "Upload batch complete."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="bulk-upload-dialog-close" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="bulk-upload-dialog-body">
          {!ytReady ? (
            <div className="bulk-upload-warn">
              <p className="bulk-upload-warn-head">
                <AlertTriangle className="h-4 w-4" /> Connect YouTube in Settings first
              </p>
              {onOpenSettings ? (
                <button type="button" className="bulk-upload-btn bulk-upload-btn--ghost" onClick={onOpenSettings}>
                  Open YouTube settings
                </button>
              ) : null}
            </div>
          ) : (
            <>
              {isDraft ? (
                <div className="bulk-upload-draft-controls">
                  <YouTubeChannelMultiPicker
                    settings={settings}
                    values={job.connectionIds}
                    onValuesChange={(ids) => jobId && bulkUploadQueue.setJobConnectionIds(jobId, ids)}
                    onChange={onChangeSettings}
                    onNeedCredentials={onOpenSettings}
                    label="Publish to channels"
                    hint="Each video uploads to every selected channel. Expand a row to override per video."
                  />

                  <div className="bulk-upload-defaults">
                    <span className="bulk-upload-defaults-label">Default privacy</span>
                    <div className="bulk-upload-privacy-row">
                      {(["unlisted", "public", "private"] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => applyPrivacyAll(p)}
                          className="bulk-upload-privacy-btn"
                          data-active={defaultPrivacy === p ? "true" : undefined}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bulk-upload-list-toolbar">
                    <span className="bulk-upload-list-count">
                      {job.items.length} video{job.items.length === 1 ? "" : "s"}
                      {job.connectionIds.length > 1
                        ? ` × ${job.connectionIds.length} channels`
                        : null}
                    </span>
                    <button
                      type="button"
                      className="bulk-upload-toolbar-btn"
                      onClick={allExpanded ? collapseAll : expandAll}
                    >
                      {allExpanded ? "Collapse all" : "Expand all"}
                    </button>
                  </div>
                </div>
              ) : null}

              {job.items.length === 0 ? (
                <p className="bulk-upload-empty">No videos in this batch.</p>
              ) : (
                <ul className="bulk-upload-list bulk-upload-list--rich">
                  {job.items.map((it) => (
                    <BulkItemRow
                      key={it.projectId}
                      item={it}
                      project={projectById.get(it.projectId)}
                      settings={settings}
                      defaultConnectionIds={job.connectionIds}
                      renderFiles={renderFiles}
                      editable={editable && it.status === "pending"}
                      removable={editable && it.status === "pending"}
                      expanded={expandedIds.has(it.projectId)}
                      onToggle={() => toggleExpanded(it.projectId)}
                      onRemove={() => removeItem(it.projectId)}
                      onChangeSettings={onChangeSettings}
                      onOpenSettings={onOpenSettings}
                      onChange={(patch) => jobId && bulkUploadQueue.updateItem(jobId, it.projectId, patch)}
                    />
                  ))}
                </ul>
              )}

              {!isDraft && doneCount + errorCount === job.items.length ? (
                <p className="bulk-upload-summary">
                  {doneCount} uploaded{errorCount ? `, ${errorCount} failed` : ""}.
                </p>
              ) : null}
            </>
          )}
        </div>

        <footer className="bulk-upload-dialog-footer">
          {isRunning ? (
            <button type="button" className="bulk-upload-btn bulk-upload-btn--primary" onClick={onClose}>
              <Minimize2 className="h-4 w-4" /> Run in background
            </button>
          ) : (
            <button type="button" className="bulk-upload-btn bulk-upload-btn--ghost" onClick={onClose}>
              {isDraft ? "Cancel" : "Close"}
            </button>
          )}
          {ytReady && isDraft ? (
            <>
              <button
                type="button"
                className="bulk-upload-btn bulk-upload-btn--primary"
                onClick={startUpload}
                disabled={job.items.length === 0 || job.connectionIds.length === 0}
              >
                <Upload className="h-4 w-4" /> Start upload
              </button>
              <button
                type="button"
                className="bulk-upload-btn bulk-upload-btn--secondary"
                onClick={() => {
                  startUpload();
                  onClose();
                }}
                disabled={job.items.length === 0 || job.connectionIds.length === 0}
              >
                Start in background
              </button>
            </>
          ) : null}
        </footer>
      </div>
    </div>
  );
};
