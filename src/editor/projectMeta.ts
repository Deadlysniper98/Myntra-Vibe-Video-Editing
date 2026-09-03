import type { Project } from "./projects";
import type { ChannelId } from "./channels";
import { COMPOSITIONS, type CompMeta } from "./compositions";
import { getYouTubePublishDefaults } from "./youtubePublishDefaults";

export type ContentTab = "videos" | "shorts";

export function resolveProjectComposition(project: Project): CompMeta | null {
  if (!project.compositionId) return null;
  return COMPOSITIONS.find((c) => c.id === project.compositionId) ?? null;
}

export function isProjectShort(project: Project): boolean {
  if (project.kind === "pipeline") return true;
  const comp = resolveProjectComposition(project);
  if (comp) return comp.height > comp.width;
  if (/short/i.test(project.compositionId ?? "") || /short/i.test(project.name)) return true;
  return false;
}

export function projectContentTab(project: Project): ContentTab {
  return isProjectShort(project) ? "shorts" : "videos";
}

/** Folder projects in Videos-then-Shorts order (matches ProjectsView tabs). Skips pipeline jobs. */
export function folderProjectsForNav(projects: Project[], folderId: ChannelId): Project[] {
  const inFolder = projects.filter((p) => p.folderId === folderId && p.kind !== "pipeline");
  const videos = inFolder.filter((p) => projectContentTab(p) === "videos");
  const shorts = inFolder.filter((p) => projectContentTab(p) === "shorts");
  return [...videos, ...shorts];
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${r.toString().padStart(2, "0")}` : `0:${r.toString().padStart(2, "0")}`;
}

export function projectDurationSec(project: Project): number | null {
  const comp = resolveProjectComposition(project);
  if (!comp) return null;
  return comp.durationInFrames / comp.fps;
}

export function projectDescriptionSnippet(project: Project, maxLen = 120): string {
  const comp = resolveProjectComposition(project);
  const defaults = comp ? getYouTubePublishDefaults(comp.id, project.name) : null;
  const raw =
    defaults?.description?.split("\n").find((ln) => ln.trim() && !ln.startsWith("#")) ??
    defaults?.description ??
    project.analysis?.videoTitle ??
    "";
  const oneLine = raw.replace(/\s+/g, " ").trim();
  if (!oneLine) return "No description yet.";
  return oneLine.length > maxLen ? `${oneLine.slice(0, maxLen - 1)}…` : oneLine;
}

export function projectCanUpload(project: Project): boolean {
  return Boolean(project.compositionId && COMPOSITIONS.some((c) => c.id === project.compositionId));
}

export function projectThumbUrl(project: Project): string | null {
  if (project.clips[0]?.url) return project.clips[0].url;
  if (project.thumbSrc) return `/${project.thumbSrc.replace(/^\//, "")}`;
  return null;
}

export function projectStatusLabel(project: Project): string {
  if (project.kind === "pipeline") {
    if (project.pipelineStatus === "analyzing") return "Analyzing";
    if (project.pipelineStatus === "clips-proposed") return "Clips proposed";
    if (project.pipelineStatus === "error") return "Error";
    return "Draft";
  }
  if (projectCanUpload(project)) return "Ready to render";
  if (project.clips.length > 0) return `${project.clips.length} clip${project.clips.length === 1 ? "" : "s"}`;
  return "Empty";
}
