/** Tracks which Vibe projects have been uploaded to which YouTube channel. */

import type { YouTubePrivacy } from "./ai/youtube";

export interface ProjectUploadRecord {
  projectId: string;
  compId?: string;
  videoId: string;
  url: string;
  title: string;
  channelConnectionId: string;
  youtubeChannelId?: string;
  privacy?: YouTubePrivacy;
  uploadedAt: string;
}

const STORAGE_KEY = "vibe.youtube.uploads.v1";

function loadAll(): ProjectUploadRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ProjectUploadRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAll(records: ProjectUploadRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function getUploadForProject(
  projectId: string,
  channelConnectionId?: string,
): ProjectUploadRecord | null {
  const records = loadAll().filter((r) => r.projectId === projectId);
  if (channelConnectionId) {
    return records.find((r) => r.channelConnectionId === channelConnectionId) ?? null;
  }
  return (
    records.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0] ??
    null
  );
}

export function getUploadsForProject(projectId: string): ProjectUploadRecord[] {
  return loadAll()
    .filter((r) => r.projectId === projectId)
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
}

export function getUploadsForChannel(channelConnectionId: string): ProjectUploadRecord[] {
  return loadAll().filter((r) => r.channelConnectionId === channelConnectionId);
}

export function recordProjectUpload(record: Omit<ProjectUploadRecord, "uploadedAt">) {
  const records = loadAll().filter(
    (r) =>
      !(
        r.projectId === record.projectId &&
        r.channelConnectionId === record.channelConnectionId
      ),
  );
  records.push({ ...record, uploadedAt: new Date().toISOString() });
  saveAll(records);
}

export function removeProjectUpload(projectId: string) {
  saveAll(loadAll().filter((r) => r.projectId !== projectId));
}

/** Match channel videos to projects by title similarity (after manual sync). */
export function linkUploadsByTitle(
  channelConnectionId: string,
  youtubeChannelId: string,
  channelVideos: { videoId: string; title: string; url: string }[],
  projects: { id: string; compositionId?: string; name: string }[],
  titleForProject: (p: { compositionId?: string; name: string }) => string,
): number {
  const records = loadAll();
  let linked = 0;
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

  for (const p of projects) {
    if (records.some((r) => r.projectId === p.id && r.channelConnectionId === channelConnectionId)) {
      continue;
    }
    const expected = norm(titleForProject(p));
    if (!expected) continue;
    const match = channelVideos.find((v) => {
      const vt = norm(v.title);
      return vt === expected || vt.includes(expected) || expected.includes(vt);
    });
    if (!match) continue;
    records.push({
      projectId: p.id,
      compId: p.compositionId,
      videoId: match.videoId,
      url: match.url,
      title: match.title,
      channelConnectionId,
      youtubeChannelId,
      uploadedAt: new Date().toISOString(),
    });
    linked += 1;
  }
  saveAll(records);
  return linked;
}
