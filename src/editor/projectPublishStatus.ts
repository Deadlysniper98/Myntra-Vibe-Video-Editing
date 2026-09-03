import type { Project } from "./projects";
import type { YouTubePrivacy } from "./ai/youtube";
import { filterRendersForComp, getLastRenderMeta } from "./renderBinding";
import { getUploadsForProject } from "./youtubeUploads";
import { resolveProjectComposition } from "./projectMeta";

export type RenderStatus = "none" | "rendered" | "stale";

export interface ProjectPublishSnapshot {
  renderStatus: RenderStatus;
  renderAt?: string;
  renderFilename?: string;
  youtubeUploaded: boolean;
  youtubePrivacy?: YouTubePrivacy;
  youtubeUploadedAt?: string;
  youtubeUrl?: string;
  /** All channel uploads for this project. */
  youtubeUploads: {
    channelConnectionId: string;
    privacy?: YouTubePrivacy;
    uploadedAt: string;
    url: string;
    title: string;
  }[];
}

export interface RenderFileInfo {
  filename: string;
  modifiedAt: string;
}

export function buildProjectPublishSnapshot(
  project: Project,
  renderFiles: RenderFileInfo[] = [],
): ProjectPublishSnapshot {
  const comp = resolveProjectComposition(project);
  const uploads = getUploadsForProject(project.id);
  const upload = uploads[0] ?? null;

  if (!comp) {
    return {
      renderStatus: "none",
      youtubeUploaded: uploads.length > 0,
      youtubePrivacy: upload?.privacy,
      youtubeUploadedAt: upload?.uploadedAt,
      youtubeUrl: upload?.url,
      youtubeUploads: uploads.map((u) => ({
        channelConnectionId: u.channelConnectionId,
        privacy: u.privacy,
        uploadedAt: u.uploadedAt,
        url: u.url,
        title: u.title,
      })),
    };
  }

  const matching = filterRendersForComp(renderFiles, comp.id);
  const lastMeta = getLastRenderMeta(comp.id);
  const onDisk = lastMeta
    ? matching.find((f) => f.filename === lastMeta.filename) ?? matching[0]
    : matching[0];

  let renderStatus: RenderStatus = "none";
  let renderAt: string | undefined;
  let renderFilename: string | undefined;

  if (onDisk) {
    renderFilename = onDisk.filename;
    renderAt = onDisk.modifiedAt || lastMeta?.at;
    renderStatus = "rendered";
  } else if (lastMeta) {
    renderFilename = lastMeta.filename;
    renderAt = lastMeta.at;
    renderStatus = "rendered";
  }

  if (upload && renderAt) {
    const renderMs = new Date(renderAt).getTime();
    const latestUploadMs = Math.max(
      ...uploads.map((u) => new Date(u.uploadedAt).getTime()).filter((t) => !Number.isNaN(t)),
    );
    if (!Number.isNaN(renderMs) && !Number.isNaN(latestUploadMs) && renderMs > latestUploadMs + 1000) {
      renderStatus = "stale";
    }
  }

  return {
    renderStatus,
    renderAt,
    renderFilename,
    youtubeUploaded: uploads.length > 0,
    youtubePrivacy: upload?.privacy,
    youtubeUploadedAt: upload?.uploadedAt,
    youtubeUrl: upload?.url,
    youtubeUploads: uploads.map((u) => ({
      channelConnectionId: u.channelConnectionId,
      privacy: u.privacy,
      uploadedAt: u.uploadedAt,
      url: u.url,
      title: u.title,
    })),
  };
}

function formatShortDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function renderStatusLabel(s: ProjectPublishSnapshot): string {
  if (s.renderStatus === "stale") return "Needs re-render";
  if (s.renderStatus === "rendered") {
    const when = formatShortDate(s.renderAt);
    return when ? `Rendered ${when}` : "Rendered";
  }
  return "Not rendered";
}

export function youtubeStatusLabel(s: ProjectPublishSnapshot): string | null {
  if (!s.youtubeUploaded) return null;
  const privacy = s.youtubePrivacy ?? "unlisted";
  const when = formatShortDate(s.youtubeUploadedAt);
  const privacyLabel =
    privacy === "public" ? "Public" : privacy === "private" ? "Private" : "Unlisted";
  return when ? `On YouTube · ${privacyLabel} · ${when}` : `On YouTube · ${privacyLabel}`;
}
