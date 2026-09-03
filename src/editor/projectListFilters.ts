import type { Project } from "./projects";
import {
  buildProjectPublishSnapshot,
  type RenderFileInfo,
} from "./projectPublishStatus";
import { projectDurationSec, resolveProjectComposition } from "./projectMeta";
import { getYouTubePublishDefaults } from "./youtubePublishDefaults";

export type ProjectSortKey =
  | "default"
  | "name-asc"
  | "name-desc"
  | "duration-asc"
  | "duration-desc"
  | "rendered-first"
  | "not-rendered-first"
  | "uploaded-first"
  | "not-uploaded-first"
  | "created-newest"
  | "created-oldest";

export const PROJECT_SORT_OPTIONS: { value: ProjectSortKey; label: string }[] = [
  { value: "default", label: "Default order" },
  { value: "created-newest", label: "Newest first" },
  { value: "created-oldest", label: "Oldest first" },
  { value: "name-asc", label: "Name A → Z" },
  { value: "name-desc", label: "Name Z → A" },
  { value: "duration-asc", label: "Shortest first" },
  { value: "duration-desc", label: "Longest first" },
  { value: "rendered-first", label: "Rendered first" },
  { value: "not-rendered-first", label: "Not rendered first" },
  { value: "uploaded-first", label: "On YouTube first" },
  { value: "not-uploaded-first", label: "Not on YouTube first" },
];

export function projectDisplayTitle(project: Project): string {
  const comp = resolveProjectComposition(project);
  if (comp) return getYouTubePublishDefaults(comp.id, project.name).title;
  return project.name;
}

export function projectSearchHaystack(project: Project): string {
  const comp = resolveProjectComposition(project);
  const defaults = comp ? getYouTubePublishDefaults(comp.id, project.name) : null;
  return [
    project.name,
    project.id,
    project.compositionId ?? "",
    defaults?.title ?? "",
    defaults?.description ?? "",
    defaults?.tags ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function renderRank(status: "none" | "rendered" | "stale"): number {
  if (status === "rendered") return 0;
  if (status === "stale") return 1;
  return 2;
}

export function filterProjects(
  projects: Project[],
  query: string,
): Project[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...projects];
  return projects.filter((p) => projectSearchHaystack(p).includes(q));
}

export function sortProjects(
  projects: Project[],
  sortKey: ProjectSortKey,
  renderFiles: RenderFileInfo[],
  orderIndex: Map<string, number>,
): Project[] {
  if (sortKey === "default") return [...projects];

  const items = projects.map((p) => ({
    project: p,
    snapshot: buildProjectPublishSnapshot(p, renderFiles),
    title: projectDisplayTitle(p).toLowerCase(),
    duration: projectDurationSec(p) ?? -1,
    order: orderIndex.get(p.id) ?? 0,
  }));

  const cmp = (a: (typeof items)[0], b: (typeof items)[0]) => {
    switch (sortKey) {
      case "name-asc":
        return a.title.localeCompare(b.title);
      case "name-desc":
        return b.title.localeCompare(a.title);
      case "duration-asc":
        return a.duration - b.duration;
      case "duration-desc":
        return b.duration - a.duration;
      case "rendered-first":
        return renderRank(a.snapshot.renderStatus) - renderRank(b.snapshot.renderStatus);
      case "not-rendered-first":
        return renderRank(b.snapshot.renderStatus) - renderRank(a.snapshot.renderStatus);
      case "uploaded-first":
        return Number(b.snapshot.youtubeUploaded) - Number(a.snapshot.youtubeUploaded);
      case "not-uploaded-first":
        return Number(a.snapshot.youtubeUploaded) - Number(b.snapshot.youtubeUploaded);
      case "created-newest":
        return b.order - a.order;
      case "created-oldest":
        return a.order - b.order;
      default:
        return 0;
    }
  };

  return items.sort(cmp).map((x) => x.project);
}

export function filterAndSortProjects(
  projects: Project[],
  query: string,
  sortKey: ProjectSortKey,
  renderFiles: RenderFileInfo[],
  orderIndex: Map<string, number>,
): Project[] {
  return sortProjects(filterProjects(projects, query), sortKey, renderFiles, orderIndex);
}
