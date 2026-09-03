// YouTube OAuth connect + upload — dev server proxies in vite-plugins/youtube-endpoints.mjs

export type YouTubePrivacy = "public" | "unlisted" | "private";

export interface YouTubeConnectCreds {
  clientId: string;
  clientSecret: string;
}

export interface YouTubeOAuthResult {
  ok: boolean;
  state?: string;
  refreshToken?: string;
  channelTitle?: string;
  youtubeChannelId?: string;
  thumbnailUrl?: string;
  clientId?: string;
  clientSecret?: string;
  error?: string;
}

export interface YouTubeUploadOpts extends YouTubeConnectCreds {
  refreshToken: string;
  filename: string;
  title: string;
  description?: string;
  tags?: string | string[];
  privacyStatus?: YouTubePrivacy;
  thumbnailPngBase64?: string;
}

export interface YouTubeRenderFile {
  filename: string;
  sizeMb: string;
  modifiedAt: string;
}

export interface YouTubeUploadResult {
  videoId: string;
  url?: string;
  studioUrl?: string;
  thumbnailWarning?: string;
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string };
    if (j.error) return j.error.slice(0, 400);
  } catch {
    // fall through
  }
  return fallback;
}

function isOAuthPayload(data: unknown): data is YouTubeOAuthResult & { type?: string } {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { type?: string }).type === "vibe-youtube-oauth"
  );
}

/** Start Google OAuth — returns URL + state for polling fallback. */
export async function startYouTubeOAuth(creds: YouTubeConnectCreds): Promise<{
  url: string;
  redirectUri: string;
  state: string;
}> {
  const res = await fetch("/api/youtube/oauth/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(creds),
  });
  if (!res.ok) throw new Error(await readError(res, `OAuth start failed (${res.status})`));
  return res.json();
}

async function pollOAuthResult(state: string): Promise<YouTubeOAuthResult | null> {
  const res = await fetch(`/api/youtube/oauth/poll?state=${encodeURIComponent(state)}`);
  if (!res.ok) return null;
  const json = (await res.json()) as { pending?: boolean } & YouTubeOAuthResult;
  if (json.pending) return null;
  return json;
}

/** Poll the dev server until OAuth completes (for manual retry or URL return). */
export async function fetchYouTubeOAuthResult(
  state: string,
  opts?: { attempts?: number; intervalMs?: number },
): Promise<YouTubeOAuthResult | null> {
  const attempts = opts?.attempts ?? 40;
  const intervalMs = opts?.intervalMs ?? 500;
  for (let i = 0; i < attempts; i++) {
    const result = await pollOAuthResult(state);
    if (result) return result;
    await new Promise((r) => window.setTimeout(r, intervalMs));
  }
  return null;
}

export const YOUTUBE_OAUTH_STATE_KEY = "vibe-youtube-oauth-state";

/**
 * Wait for OAuth completion — postMessage, BroadcastChannel, and server poll.
 * Google OAuth often breaks window.opener, so polling is the reliable fallback.
 */
export function waitForYouTubeOAuth(state: string, timeoutMs = 120_000): Promise<YouTubeOAuthResult> {
  return new Promise((resolve, reject) => {
    const origin = window.location.origin;
    let settled = false;

    const finish = (result: YouTubeOAuthResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      window.clearInterval(pollTimer);
      window.removeEventListener("message", onMsg);
      try {
        bc?.close();
      } catch {
        /* ignore */
      }
      resolve(result);
    };

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      window.clearInterval(pollTimer);
      window.removeEventListener("message", onMsg);
      try {
        bc?.close();
      } catch {
        /* ignore */
      }
      reject(err);
    };

    const onPayload = (data: unknown) => {
      if (!isOAuthPayload(data)) return;
      if (data.state && data.state !== state) return;
      finish(data);
    };

    const onMsg = (ev: MessageEvent) => {
      if (ev.origin !== origin) return;
      onPayload(ev.data);
    };

    let bc: BroadcastChannel | undefined;
    try {
      bc = new BroadcastChannel("vibe-youtube-oauth");
      bc.onmessage = (ev) => onPayload(ev.data);
    } catch {
      bc = undefined;
    }

    window.addEventListener("message", onMsg);

    const pollTimer = window.setInterval(async () => {
      try {
        const result = await pollOAuthResult(state);
        if (result) finish(result);
      } catch {
        /* keep polling */
      }
    }, 800);

    const timer = window.setTimeout(() => {
      fail(new Error("YouTube sign-in timed out — close the popup and try again."));
    }, timeoutMs);
  });
}

/** List rendered video files in the project's `out/` folder (newest first). */
export async function listYouTubeRenders(): Promise<YouTubeRenderFile[]> {
  const res = await fetch("/api/youtube/renders");
  if (!res.ok) throw new Error(await readError(res, `List renders failed (${res.status})`));
  const json = (await res.json()) as { files?: YouTubeRenderFile[] };
  return json.files ?? [];
}

/** Open `out/<filename>` in the system file manager (Explorer on Windows). */
export async function revealRenderInExplorer(filename: string): Promise<void> {
  const res = await fetch("/api/youtube/reveal-render", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ filename }),
  });
  if (!res.ok) throw new Error(await readError(res, `Reveal failed (${res.status})`));
}

/** Upload a rendered file from `out/` to the connected YouTube channel. */
export async function uploadToYouTube(opts: YouTubeUploadOpts): Promise<YouTubeUploadResult> {
  const res = await fetch("/api/youtube/upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!res.ok) throw new Error(await readError(res, `Upload failed (${res.status})`));
  return res.json();
}

export interface YouTubeChannelDetails {
  channelId: string;
  title: string;
  description: string;
  customUrl?: string;
  thumbnailUrl?: string;
  bannerUrl?: string;
  uploadsPlaylistId?: string;
}

export interface YouTubeChannelVideo {
  videoId: string;
  title: string;
  publishedAt?: string;
  thumbnailUrl?: string;
  url?: string;
}

type ChannelAuth = YouTubeConnectCreds & { refreshToken: string };

export async function fetchYouTubeChannelDetails(opts: ChannelAuth): Promise<YouTubeChannelDetails> {
  const res = await fetch("/api/youtube/channel", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!res.ok) throw new Error(await readError(res, `Channel fetch failed (${res.status})`));
  return res.json();
}

export async function updateYouTubeChannel(
  opts: ChannelAuth & { channelId: string; title: string; description: string },
): Promise<{ channelId: string; title: string; description: string }> {
  const res = await fetch("/api/youtube/channel/update", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!res.ok) throw new Error(await readError(res, `Channel update failed (${res.status})`));
  return res.json();
}

export async function listYouTubeChannelVideos(
  opts: ChannelAuth & { maxResults?: number },
): Promise<{ videos: YouTubeChannelVideo[]; channelId: string }> {
  const res = await fetch("/api/youtube/channel/videos", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!res.ok) throw new Error(await readError(res, `List videos failed (${res.status})`));
  return res.json();
}
