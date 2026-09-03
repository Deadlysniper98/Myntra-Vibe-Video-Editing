import type { Project } from "./projects";
import type { Settings } from "./settings";
import type { YouTubePrivacy } from "./ai/youtube";
import { COMPOSITIONS } from "./compositions";
import {
  defaultRenderSettingsForComp,
  projectToPublishTarget,
  renderAndPublish,
  type PublishProgress,
  type PublishStage,
} from "./publishPipeline";
import { getYouTubePublishDefaults } from "./youtubePublishDefaults";
import type { ChannelId } from "./channels";
import { resolveYouTubeChannel, getYouTubeChannels } from "./youtubeChannels";
import { recordProjectUpload } from "./youtubeUploads";
import { generateThumbnailForProject } from "./thumbnailGenerator";

export type BulkItemStatus = "pending" | "active" | "done" | "error";

export interface BulkUploadItemDraft {
  projectId: string;
  projectName: string;
  compId: string;
  folderId: string;
  thumbSrc?: string;
  aspect: string;
  durationSec: number | null;
  isVertical: boolean;
  title: string;
  description: string;
  tags: string;
  privacy: YouTubePrivacy;
  /** Per-video channel override. Empty = use job default. */
  connectionIds?: string[];
  status: BulkItemStatus;
  stage: PublishStage | "idle";
  progress: number;
  message: string;
  url?: string;
  error?: string;
}

export type BulkJobStatus = "draft" | "queued" | "running" | "done" | "cancelled";

export interface BulkUploadJob {
  id: string;
  label: string;
  createdAt: string;
  status: BulkJobStatus;
  settingsSnapshot: Settings;
  /** Channels to publish every item in this batch to. */
  connectionIds: string[];
  items: BulkUploadItemDraft[];
}

type Listener = () => void;

function newJobId() {
  return `bulk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function itemFromProject(project: Project, privacy: YouTubePrivacy): BulkUploadItemDraft | null {
  const target = projectToPublishTarget(project);
  if (!target) return null;
  const comp = COMPOSITIONS.find((c) => c.id === target.compId);
  if (!comp) return null;
  const defaults = getYouTubePublishDefaults(target.compId, target.projectName);
  return {
    projectId: project.id,
    projectName: project.name,
    compId: target.compId,
    folderId: target.folderId,
    thumbSrc: target.thumbSrc,
    aspect: comp.aspect,
    durationSec: comp.durationInFrames / comp.fps,
    isVertical: comp.height > comp.width,
    title: defaults.title,
    description: defaults.description,
    tags: defaults.tags,
    privacy,
    status: "pending",
    stage: "idle",
    progress: 0,
    message: "Waiting…",
  };
}

class BulkUploadQueue {
  private jobs: BulkUploadJob[] = [];
  private listeners = new Set<Listener>();
  private pumping = false;
  private cancelRequested = new Set<string>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  getJobs(): BulkUploadJob[] {
    return this.jobs.map((j) => ({
      ...j,
      items: j.items.map((it) => ({ ...it })),
    }));
  }

  getJob(jobId: string): BulkUploadJob | undefined {
    const j = this.jobs.find((x) => x.id === jobId);
    if (!j) return undefined;
    return { ...j, items: j.items.map((it) => ({ ...it })) };
  }

  getActiveSummary(): { running: number; pending: number; done: number; failed: number; jobs: number } {
    let running = 0;
    let pending = 0;
    let done = 0;
    let failed = 0;
    let activeJobs = 0;
    for (const job of this.jobs) {
      if (job.status === "draft") continue;
      if (job.status === "running" || job.status === "queued") activeJobs += 1;
      for (const it of job.items) {
        if (it.status === "active") running += 1;
        else if (it.status === "pending") pending += 1;
        else if (it.status === "done") done += 1;
        else if (it.status === "error") failed += 1;
      }
    }
    return { running, pending, done, failed, jobs: activeJobs };
  }

  createDraft(projects: Project[], settings: Settings, privacy: YouTubePrivacy = "unlisted"): string {
    const items = projects
      .map((p) => itemFromProject(p, privacy))
      .filter((x): x is BulkUploadItemDraft => x !== null);
    const firstFolder = items[0]?.folderId;
    const defaultConnection = firstFolder
      ? resolveYouTubeChannel(settings, { folderId: firstFolder as Project["folderId"] })?.id
      : undefined;
    const allIds = getYouTubeChannels(settings).map((c) => c.id);
    const job: BulkUploadJob = {
      id: newJobId(),
      label: `Bulk upload · ${items.length} video${items.length === 1 ? "" : "s"}`,
      createdAt: new Date().toISOString(),
      status: "draft",
      settingsSnapshot: JSON.parse(JSON.stringify(settings)) as Settings,
      connectionIds: defaultConnection ? [defaultConnection] : allIds.slice(0, 1),
      items,
    };
    this.jobs.unshift(job);
    this.emit();
    return job.id;
  }

  updateItem(
    jobId: string,
    projectId: string,
    patch: Partial<
      Pick<BulkUploadItemDraft, "title" | "description" | "tags" | "privacy" | "connectionIds">
    >,
  ) {
    const job = this.jobs.find((j) => j.id === jobId);
    if (!job || (job.status !== "draft" && job.status !== "queued")) return;
    const item = job.items.find((it) => it.projectId === projectId);
    if (!item || item.status !== "pending") return;
    Object.assign(item, patch);
    this.emit();
  }

  setJobPrivacy(jobId: string, privacy: YouTubePrivacy) {
    const job = this.jobs.find((j) => j.id === jobId);
    if (!job || job.status !== "draft") return;
    for (const it of job.items) {
      if (it.status === "pending") it.privacy = privacy;
    }
    this.emit();
  }

  setJobConnectionIds(jobId: string, connectionIds: string[]) {
    const job = this.jobs.find((j) => j.id === jobId);
    if (!job || job.status !== "draft") return;
    job.connectionIds = connectionIds;
    this.emit();
  }

  removeItem(jobId: string, projectId: string) {
    const job = this.jobs.find((j) => j.id === jobId);
    if (!job || job.status !== "draft") return;
    const item = job.items.find((it) => it.projectId === projectId);
    if (!item || item.status !== "pending") return;
    job.items = job.items.filter((it) => it.projectId !== projectId);
    job.label = `Bulk upload · ${job.items.length} video${job.items.length === 1 ? "" : "s"}`;
    if (job.items.length === 0) job.status = "cancelled";
    this.emit();
  }

  startJob(jobId: string) {
    const job = this.jobs.find((j) => j.id === jobId);
    if (!job || job.status !== "draft" || job.items.length === 0) return;
    job.status = "queued";
    this.cancelRequested.delete(jobId);
    this.emit();
    void this.pump();
  }

  cancelJob(jobId: string) {
    const job = this.jobs.find((j) => j.id === jobId);
    if (!job) return;
    this.cancelRequested.add(jobId);
    if (job.status === "draft") job.status = "cancelled";
    for (const it of job.items) {
      if (it.status === "pending") {
        it.status = "error";
        it.message = "Cancelled";
        it.error = "Cancelled";
      }
    }
    if (job.status === "queued") job.status = "cancelled";
    this.emit();
  }

  dismissJob(jobId: string) {
    const job = this.jobs.find((j) => j.id === jobId);
    if (!job) return;
    if (job.status === "running" || job.status === "queued") return;
    this.jobs = this.jobs.filter((j) => j.id !== jobId);
    this.emit();
  }

  private patchItem(jobId: string, projectId: string, patch: Partial<BulkUploadItemDraft>) {
    const job = this.jobs.find((j) => j.id === jobId);
    const item = job?.items.find((it) => it.projectId === projectId);
    if (!item) return;
    Object.assign(item, patch);
    this.emit();
  }

  private findNextPending(): { job: BulkUploadJob; item: BulkUploadItemDraft } | null {
    for (const job of this.jobs) {
      if (job.status !== "queued" && job.status !== "running") continue;
      if (this.cancelRequested.has(job.id)) continue;
      const item = job.items.find((it) => it.status === "pending");
      if (item) return { job, item };
    }
    return null;
  }

  private finalizeJob(job: BulkUploadJob) {
    if (this.cancelRequested.has(job.id)) {
      job.status = "cancelled";
      return;
    }
    const hasPending = job.items.some((it) => it.status === "pending" || it.status === "active");
    if (!hasPending) job.status = "done";
  }

  private async pump() {
    if (this.pumping) return;
    this.pumping = true;
    try {
      for (;;) {
        const next = this.findNextPending();
        if (!next) break;
        const { job, item } = next;
        if (this.cancelRequested.has(job.id)) {
          job.status = "cancelled";
          this.emit();
          continue;
        }
        job.status = "running";
        await this.processItem(job, item);
        this.finalizeJob(job);
        this.emit();
      }
      for (const job of this.jobs) {
        if (job.status === "queued") this.finalizeJob(job);
      }
    } finally {
      this.pumping = false;
      this.emit();
    }
  }

  private itemConnectionIds(job: BulkUploadJob, item: BulkUploadItemDraft): string[] {
    const ids = item.connectionIds?.length ? item.connectionIds : job.connectionIds;
    return ids.filter(Boolean);
  }

  private async processItem(job: BulkUploadJob, item: BulkUploadItemDraft) {
    const target = projectToPublishTarget({
      id: item.projectId,
      name: item.projectName,
      folderId: item.folderId as Project["folderId"],
      compositionId: item.compId,
      thumbSrc: item.thumbSrc,
      clips: [],
    });
    if (!target) {
      this.patchItem(job.id, item.projectId, {
        status: "error",
        message: "No composition",
        error: "No composition",
      });
      return;
    }

    const comp = COMPOSITIONS.find((c) => c.id === target.compId)!;
    const channelIds = this.itemConnectionIds(job, item);
    if (channelIds.length === 0) {
      this.patchItem(job.id, item.projectId, {
        status: "error",
        message: "No channel selected",
        error: "Select at least one YouTube channel",
      });
      return;
    }

    this.patchItem(job.id, item.projectId, {
      status: "active",
      stage: "rendering",
      message: "Starting…",
      progress: 0,
    });

    const thumb = await generateThumbnailForProject({
      title: item.title.trim(),
      thumbSrc: item.thumbSrc ? `/${item.thumbSrc.replace(/^\//, "")}` : undefined,
      isVertical: item.isVertical,
      compId: item.compId,
    });
    const thumbPngBase64 = thumb?.pngBase64;

    const urls: string[] = [];

    for (let i = 0; i < channelIds.length; i++) {
      const connectionId = channelIds[i];
      const ytChannel = resolveYouTubeChannel(job.settingsSnapshot, {
        projectId: item.projectId,
        folderId: item.folderId as ChannelId,
        connectionId,
      });
      const chLabel = ytChannel?.channelTitle ?? `Channel ${i + 1}`;

      const onProgress = (prog: PublishProgress) => {
        const prefix =
          channelIds.length > 1 ? `${chLabel} (${i + 1}/${channelIds.length}) · ` : "";
        this.patchItem(job.id, item.projectId, {
          stage: prog.stage,
          progress: prog.renderProgress,
          message:
            prog.stage === "rendering"
              ? `${prefix}Rendering ${prog.renderProgress}%`
              : prog.stage === "thumbnail"
                ? `${prefix}Generating thumbnail…`
                : prog.stage === "uploading"
                  ? `${prefix}Uploading…`
                  : `${prefix}${prog.message}`,
        });
      };

      try {
        const { url, videoId } = await renderAndPublish({
          settings: job.settingsSnapshot,
          target,
          title: item.title,
          description: item.description,
          tags: item.tags,
          privacy: item.privacy,
          connectionId,
          renderSettings: defaultRenderSettingsForComp(
            comp.id,
            comp.width,
            comp.height,
            comp.fps,
            comp.durationInFrames,
          ),
          skipRender: i > 0,
          thumbnailPngBase64: thumbPngBase64,
          onProgress,
        });
        if (ytChannel) {
          recordProjectUpload({
            projectId: item.projectId,
            compId: item.compId,
            videoId,
            url,
            title: item.title,
            channelConnectionId: ytChannel.id,
            youtubeChannelId: ytChannel.youtubeChannelId,
            privacy: item.privacy,
          });
        }
        urls.push(url);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.patchItem(job.id, item.projectId, {
          status: "error",
          stage: "error",
          message:
            channelIds.length > 1
              ? `Failed on ${chLabel}: ${msg.slice(0, 120)}`
              : msg.slice(0, 160),
          error: msg,
        });
        return;
      }
    }

    this.patchItem(job.id, item.projectId, {
      status: "done",
      stage: "done",
      progress: 100,
      message:
        channelIds.length > 1
          ? `Uploaded to ${channelIds.length} channels`
          : "Uploaded",
      url: urls[0],
    });
  }
}

export const bulkUploadQueue = new BulkUploadQueue();
