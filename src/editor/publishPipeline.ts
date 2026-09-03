import type { ChannelId } from "./channels";
import type { Project } from "./projects";
import type { Settings } from "./settings";
import { uploadToYouTube, type YouTubePrivacy } from "./ai/youtube";
import {
  getYouTubeOAuthCreds,
  resolveYouTubeChannel,
} from "./youtubeChannels";
import {
  defaultRenderFilename,
  saveLastRenderForComp,
} from "./renderBinding";
import {
  getRenderStatus,
  startRender,
  type RenderSettings,
} from "./render";
import { getYouTubePublishDefaults } from "./youtubePublishDefaults";
import { generateThumbnailForProject } from "./thumbnailGenerator";
import { COMPOSITIONS } from "./compositions";

export type PublishStage = "idle" | "rendering" | "thumbnail" | "uploading" | "done" | "error";

export interface PublishProgress {
  stage: PublishStage;
  renderProgress: number;
  message: string;
  error?: string;
  uploadUrl?: string;
}

export interface PublishTarget {
  projectId: string;
  projectName: string;
  compId: string;
  folderId: ChannelId;
  thumbSrc?: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  props: unknown;
}

export function projectToPublishTarget(project: Project): PublishTarget | null {
  if (!project.compositionId) return null;
  const comp = COMPOSITIONS.find((c) => c.id === project.compositionId);
  if (!comp) return null;
  return {
    projectId: project.id,
    projectName: project.name,
    compId: comp.id,
    folderId: project.folderId,
    thumbSrc: project.thumbSrc,
    width: comp.width,
    height: comp.height,
    fps: comp.fps,
    durationInFrames: comp.durationInFrames,
    props: {},
  };
}

export function defaultRenderSettingsForComp(
  compId: string,
  width: number,
  height: number,
  fps: number,
  durationInFrames: number,
): RenderSettings {
  const minDim = Math.min(width, height);
  const scale = 1080 / minDim;
  return {
    formatId: "mp4-h264",
    crf: 18,
    resolution: 1080,
    scale,
    fps,
    startFrame: 0,
    endFrame: durationInFrames - 1,
    filename: defaultRenderFilename(compId),
  };
}

async function waitForRender(
  jobId: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  for (;;) {
    const job = await getRenderStatus(jobId);
    onProgress(job.progress);
    if (job.status === "done") return;
    if (job.status === "error") throw new Error(job.error || "Render failed");
    await new Promise((r) => setTimeout(r, 1000));
  }
}

export interface PublishOptions {
  settings: Settings;
  target: PublishTarget;
  /** Override resolved folder/project channel for this upload only. */
  connectionId?: string;
  title?: string;
  description?: string;
  tags?: string;
  privacy?: YouTubePrivacy;
  renderSettings?: RenderSettings;
  skipRender?: boolean;
  thumbnailPngBase64?: string;
  onProgress?: (p: PublishProgress) => void;
}

export async function renderAndPublish(opts: PublishOptions): Promise<{ url: string; videoId: string }> {
  const { settings, target, onProgress } = opts;
  const report = (patch: Partial<PublishProgress>) =>
    onProgress?.({
      stage: "idle",
      renderProgress: 0,
      message: "",
      ...patch,
    });

  const ytCreds = getYouTubeOAuthCreds(settings);
  const channel = resolveYouTubeChannel(settings, {
    projectId: target.projectId,
    folderId: target.folderId,
    connectionId: opts.connectionId,
  });
  if (!channel?.refreshToken || !ytCreds.clientId || !ytCreds.clientSecret) {
    throw new Error("Connect YouTube in Settings and assign a channel for this project.");
  }

  const defaults = getYouTubePublishDefaults(target.compId, target.projectName);
  const title = opts.title?.trim() || defaults.title;
  const description = opts.description ?? defaults.description;
  const tags = opts.tags ?? defaults.tags;
  const privacy = opts.privacy ?? "unlisted";

  const renderSettings =
    opts.renderSettings ??
    defaultRenderSettingsForComp(
      target.compId,
      target.width,
      target.height,
      target.fps,
      target.durationInFrames,
    );

  if (!opts.skipRender) {
    report({ stage: "rendering", message: "Rendering video…", renderProgress: 0 });
    const jobId = await startRender(target.compId, renderSettings, target.props);
    await waitForRender(jobId, (pct) =>
      report({ stage: "rendering", message: `Rendering… ${pct}%`, renderProgress: pct }),
    );
    saveLastRenderForComp(target.compId, renderSettings.filename);
  }

  report({ stage: "thumbnail", message: "Generating thumbnail…", renderProgress: 100 });
  const isVertical = target.height > target.width;
  let thumbPngBase64 = opts.thumbnailPngBase64;
  if (!thumbPngBase64) {
    const thumb = await generateThumbnailForProject({
      title,
      thumbSrc: target.thumbSrc ? `/${target.thumbSrc.replace(/^\//, "")}` : undefined,
      isVertical,
      accent: "#FF3B6E",
      compId: target.compId,
    });
    thumbPngBase64 = thumb?.pngBase64;
  }

  report({ stage: "uploading", message: "Uploading to YouTube…", renderProgress: 100 });
  const result = await uploadToYouTube({
    clientId: ytCreds.clientId,
    clientSecret: ytCreds.clientSecret,
    refreshToken: channel.refreshToken,
    filename: renderSettings.filename,
    title,
    description,
    tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    privacyStatus: privacy,
    thumbnailPngBase64: thumbPngBase64,
  });

  const url = result.url || result.studioUrl || "";
  report({
    stage: "done",
    message: result.thumbnailWarning
      ? `Uploaded (thumbnail warning: ${result.thumbnailWarning})`
      : "Uploaded successfully",
    uploadUrl: url,
    renderProgress: 100,
  });
  return { url, videoId: result.videoId };
}
