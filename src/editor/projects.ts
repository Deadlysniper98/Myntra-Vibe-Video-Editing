import type { ChannelId } from "./channels";
import type { AnalyzeResult } from "./ai/clipAnalysis";

export interface Clip {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
}

export type PipelineStatus = "draft" | "analyzing" | "clips-proposed" | "error";

export interface Project {
  id: string;
  name: string;
  folderId: ChannelId;
  builtin?: boolean;
  compositionId?: string;
  thumbSrc?: string;
  clips: Clip[];
  kind?: "composition" | "pipeline";
  sourceUrl?: string;
  pipelineStatus?: PipelineStatus;
  analysis?: AnalyzeResult;
  pipelineError?: string;
}

export const PROMO_PROJECT_ID = "promo";
const STORAGE_KEY = "myntra.vibe.projects.v1";

const promoProject = (): Project => ({
  id: PROMO_PROJECT_ID,
  name: "MynnovAIte",
  folderId: "myntra",
  builtin: true,
  compositionId: "MyComp",
  thumbSrc: "hackerramp-logo.png",
  clips: [],
});

interface SavedProject {
  id: string;
  name: string;
  kind?: "composition" | "pipeline";
  sourceUrl?: string;
}

export function createPipelineProject(url: string, folderId: ChannelId): Project {
  return {
    id: `pipeline-${crypto.randomUUID()}`,
    name: url.length > 60 ? `${url.slice(0, 57)}...` : url,
    folderId,
    kind: "pipeline",
    sourceUrl: url,
    pipelineStatus: "draft",
    clips: [],
  };
}

function loadSavedUserProjects(): SavedProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedProject[]) : [];
  } catch {
    return [];
  }
}

export function loadProjects(): Project[] {
  const user = loadSavedUserProjects()
    .filter((p) => p.id !== PROMO_PROJECT_ID)
    .map((p) => ({
      id: p.id,
      name: p.name,
      folderId: "myntra" as const,
      clips: [] as Clip[],
      ...(p.kind === "pipeline" ? { kind: "pipeline" as const, sourceUrl: p.sourceUrl, pipelineStatus: "draft" as const } : {}),
    }));
  return [promoProject(), ...user];
}

export function saveProjects(projects: Project[]): void {
  try {
    const slim: SavedProject[] = projects
      .filter((p) => !p.builtin)
      .map((p) => ({ id: p.id, name: p.name, ...(p.kind === "pipeline" ? { kind: "pipeline" as const, sourceUrl: p.sourceUrl } : {}) }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
  } catch {
    // Storage may be unavailable in private browsing or embedded previews.
  }
}

const VIDEO_RE = /\.(mp4|mov|webm|m4v|mkv|avi)$/i;

export async function pickVideosFromFolder(): Promise<File[]> {
  const w = window as unknown as { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandleLike> };
  if (typeof w.showDirectoryPicker === "function") {
    try {
      const dir = await w.showDirectoryPicker();
      const files: File[] = [];
      const walk = async (handle: FileSystemDirectoryHandleLike) => {
        for await (const entry of handle.values()) {
          if (entry.kind === "file" && VIDEO_RE.test(entry.name)) files.push(await entry.getFile());
          else if (entry.kind === "directory") await walk(entry);
        }
      };
      await walk(dir);
      return files;
    } catch {
      return [];
    }
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    (input as unknown as { webkitdirectory: boolean }).webkitdirectory = true;
    input.multiple = true;
    input.accept = "video/*";
    input.onchange = () => resolve(input.files ? Array.from(input.files).filter((f) => f.type.startsWith("video/") || VIDEO_RE.test(f.name)) : []);
    input.click();
  });
}

export function filesToClips(files: File[]): Clip[] {
  return files.map((f, i) => ({ id: `${f.name}-${f.size}-${i}`, name: f.name, url: URL.createObjectURL(f), size: f.size, type: f.type || "video" }));
}

interface FileSystemDirectoryHandleLike {
  kind: "directory";
  name: string;
  values(): AsyncIterable<{ kind: "file"; name: string; getFile(): Promise<File> } | FileSystemDirectoryHandleLike>;
}


