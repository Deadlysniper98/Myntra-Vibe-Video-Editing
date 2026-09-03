import type { Settings } from "./settings";
import type { YouTubePrivacy } from "./ai/youtube";
import { resolveYouTubeChannel } from "./youtubeChannels";
import { recordProjectUpload } from "./youtubeUploads";
import {
  renderAndPublish,
  type PublishProgress,
  type PublishTarget,
} from "./publishPipeline";
import type { RenderSettings } from "./render";

export type PublishJobStatus = "running" | "done" | "error";

export interface PublishJobResult {
  id: string;
  title: string;
  url: string;
}

export interface PublishJob {
  id: string;
  projectId: string;
  projectName: string;
  status: PublishJobStatus;
  progress: PublishProgress;
  results: PublishJobResult[];
  createdAt: number;
  finishedAt?: number;
}

export interface StartPublishParams {
  settings: Settings;
  target: PublishTarget;
  title: string;
  description: string;
  tags: string;
  privacy: YouTubePrivacy;
  connectionIds: string[];
  renderSettings: RenderSettings;
  skipRenderForFirst: boolean;
  thumbnailPngBase64?: string;
}

type Listener = () => void;

function newJobId() {
  return `pub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function progressPct(progress: PublishProgress): number {
  if (progress.stage === "rendering") return progress.renderProgress;
  if (progress.stage === "thumbnail") return 92;
  if (progress.stage === "uploading") return 96;
  if (progress.stage === "done") return 100;
  return 0;
}

class PublishJobQueue {
  private jobs: PublishJob[] = [];
  private listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  getJobs(): PublishJob[] {
    return this.jobs.map((j) => ({ ...j, progress: { ...j.progress }, results: [...j.results] }));
  }

  getJobForProject(projectId: string): PublishJob | undefined {
    return this.getJobs().find((j) => j.projectId === projectId && j.status === "running");
  }

  getActiveJobs(): PublishJob[] {
    return this.getJobs().filter((j) => j.status === "running");
  }

  getRecentJobs(): PublishJob[] {
    const cutoff = Date.now() - 10 * 60 * 1000;
    return this.getJobs().filter(
      (j) => j.status !== "running" && (j.finishedAt ?? j.createdAt) >= cutoff,
    );
  }

  dismissJob(jobId: string) {
    this.jobs = this.jobs.filter((j) => j.id !== jobId);
    this.emit();
  }

  startPublish(params: StartPublishParams): string {
    const existing = this.jobs.find((j) => j.projectId === params.target.projectId && j.status === "running");
    if (existing) return existing.id;

    const job: PublishJob = {
      id: newJobId(),
      projectId: params.target.projectId,
      projectName: params.target.projectName,
      status: "running",
      progress: { stage: "rendering", renderProgress: 0, message: "Starting…" },
      results: [],
      createdAt: Date.now(),
    };
    this.jobs.unshift(job);
    this.emit();
    void this.run(job.id, params);
    return job.id;
  }

  private patchJob(jobId: string, patch: Partial<PublishJob>) {
    const idx = this.jobs.findIndex((j) => j.id === jobId);
    if (idx < 0) return;
    this.jobs[idx] = { ...this.jobs[idx], ...patch };
    this.emit();
  }

  private async run(jobId: string, params: StartPublishParams) {
    const { settings, target, connectionIds } = params;
    const results: PublishJobResult[] = [];

    try {
      for (let i = 0; i < connectionIds.length; i++) {
        const connectionId = connectionIds[i];
        const ytChannel = resolveYouTubeChannel(settings, { connectionId });
        const chLabel = ytChannel?.channelTitle ?? `Channel ${i + 1}`;
        const prefix = connectionIds.length > 1 ? `${chLabel} (${i + 1}/${connectionIds.length}) · ` : "";

        const { url, videoId } = await renderAndPublish({
          settings,
          target,
          title: params.title,
          description: params.description,
          tags: params.tags,
          privacy: params.privacy,
          connectionId,
          renderSettings: params.renderSettings,
          skipRender: (params.skipRenderForFirst && i === 0) || i > 0,
          thumbnailPngBase64: params.thumbnailPngBase64,
          onProgress: (prog) =>
            this.patchJob(jobId, {
              progress: {
                ...prog,
                message:
                  prog.stage === "rendering"
                    ? `${prefix}Rendering… ${prog.renderProgress}%`
                    : prog.stage === "uploading"
                      ? `${prefix}Uploading…`
                      : `${prefix}${prog.message}`,
              },
            }),
        });

        if (ytChannel) {
          recordProjectUpload({
            projectId: target.projectId,
            compId: target.compId,
            videoId,
            url,
            title: params.title,
            channelConnectionId: ytChannel.id,
            youtubeChannelId: ytChannel.youtubeChannelId,
            privacy: params.privacy,
          });
        }
        results.push({ id: connectionId, title: chLabel, url });
        this.patchJob(jobId, { results: [...results] });
      }

      this.patchJob(jobId, {
        status: "done",
        finishedAt: Date.now(),
        progress: {
          stage: "done",
          renderProgress: 100,
          message: results.length > 1 ? `Uploaded to ${results.length} channels` : "Uploaded successfully",
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.patchJob(jobId, {
        status: "error",
        finishedAt: Date.now(),
        results,
        progress: { stage: "error", renderProgress: 0, message: msg, error: msg },
      });
    }
  }
}

export const publishJobQueue = new PublishJobQueue();
export { progressPct };


