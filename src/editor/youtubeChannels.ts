import type { ChannelId } from "./channels";
import type { Settings, YouTubeChannelConnection, YouTubeSettings } from "./settings";

export type { YouTubeChannelConnection, YouTubeSettings };

function newId() {
  return `yt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Normalize legacy single-channel settings → multi-channel shape. */
export function normalizeYouTubeSettings(raw: Settings["youtube"]): YouTubeSettings | undefined {
  if (!raw) return undefined;
  const any = raw as YouTubeSettings & {
    refreshToken?: string;
    channelTitle?: string;
    connectedAt?: string;
    youtubeChannelId?: string;
  };
  if (Array.isArray(any.channels) && any.channels.length > 0) {
    return {
      clientId: any.clientId ?? "",
      clientSecret: any.clientSecret ?? "",
      channels: any.channels,
      projectChannels: any.projectChannels ?? {},
      folderChannels: any.folderChannels ?? {},
    };
  }
  if (any.refreshToken) {
    return {
      clientId: any.clientId ?? "",
      clientSecret: any.clientSecret ?? "",
      channels: [
        {
          id: newId(),
          youtubeChannelId: any.youtubeChannelId,
          channelTitle: any.channelTitle ?? "YouTube channel",
          refreshToken: any.refreshToken,
          connectedAt: any.connectedAt ?? new Date().toISOString(),
        },
      ],
      projectChannels: {},
      folderChannels: {},
    };
  }
  if (any.clientId || any.clientSecret) {
    return {
      clientId: any.clientId ?? "",
      clientSecret: any.clientSecret ?? "",
      channels: [],
      projectChannels: {},
      folderChannels: {},
    };
  }
  return undefined;
}

export function getYouTubeChannels(settings: Settings): YouTubeChannelConnection[] {
  return normalizeYouTubeSettings(settings.youtube)?.channels ?? [];
}

export function getYouTubeOAuthCreds(settings: Settings): { clientId: string; clientSecret: string } {
  const yt = normalizeYouTubeSettings(settings.youtube);
  return { clientId: yt?.clientId ?? "", clientSecret: yt?.clientSecret ?? "" };
}

export function hasYouTubeChannels(settings: Settings): boolean {
  return getYouTubeChannels(settings).length > 0;
}

export function resolveYouTubeChannel(
  settings: Settings,
  opts: { projectId?: string; folderId?: ChannelId; connectionId?: string },
): YouTubeChannelConnection | null {
  const yt = normalizeYouTubeSettings(settings.youtube);
  if (!yt?.channels.length) return null;

  const pick = (id?: string) => yt.channels.find((c) => c.id === id) ?? null;

  if (opts.connectionId) return pick(opts.connectionId);
  if (opts.projectId && yt.projectChannels?.[opts.projectId]) {
    return pick(yt.projectChannels[opts.projectId]);
  }
  if (opts.folderId && yt.folderChannels?.[opts.folderId]) {
    return pick(yt.folderChannels[opts.folderId]);
  }
  return yt.channels[0] ?? null;
}

export function patchYouTubeSettings(
  settings: Settings,
  patch: Partial<YouTubeSettings>,
): Settings {
  const base = normalizeYouTubeSettings(settings.youtube) ?? {
    clientId: "",
    clientSecret: "",
    channels: [],
    projectChannels: {},
    folderChannels: {},
  };
  return {
    ...settings,
    youtube: { ...base, ...patch },
  };
}

export function setYouTubeOAuthCreds(
  settings: Settings,
  creds: { clientId?: string; clientSecret?: string },
): Settings {
  return patchYouTubeSettings(settings, creds);
}

export function addYouTubeChannelFromOAuth(
  settings: Settings,
  result: {
    refreshToken: string;
    channelTitle?: string;
    youtubeChannelId?: string;
    thumbnailUrl?: string;
    clientId?: string;
    clientSecret?: string;
  },
): Settings {
  const yt = normalizeYouTubeSettings(settings.youtube) ?? {
    clientId: "",
    clientSecret: "",
    channels: [],
    projectChannels: {},
    folderChannels: {},
  };
  const clientId = result.clientId || yt.clientId;
  const clientSecret = result.clientSecret || yt.clientSecret;
  const duplicate = result.youtubeChannelId
    ? yt.channels.find((c) => c.youtubeChannelId === result.youtubeChannelId)
    : yt.channels.find(
        (c) =>
          c.channelTitle === result.channelTitle &&
          c.refreshToken === result.refreshToken,
      );

  const connection: YouTubeChannelConnection = duplicate
    ? {
        ...duplicate,
        channelTitle: result.channelTitle ?? duplicate.channelTitle,
        refreshToken: result.refreshToken,
        youtubeChannelId: result.youtubeChannelId ?? duplicate.youtubeChannelId,
        thumbnailUrl: result.thumbnailUrl ?? duplicate.thumbnailUrl,
        connectedAt: new Date().toISOString(),
      }
    : {
        id: newId(),
        youtubeChannelId: result.youtubeChannelId,
        channelTitle: result.channelTitle ?? "YouTube channel",
        thumbnailUrl: result.thumbnailUrl,
        refreshToken: result.refreshToken,
        connectedAt: new Date().toISOString(),
      };

  const channels = duplicate
    ? yt.channels.map((c) => (c.id === duplicate.id ? connection : c))
    : [...yt.channels, connection];

  return {
    ...settings,
    youtube: { ...yt, clientId, clientSecret, channels },
  };
}

export function removeYouTubeChannel(settings: Settings, connectionId: string): Settings {
  const yt = normalizeYouTubeSettings(settings.youtube);
  if (!yt) return settings;
  const channels = yt.channels.filter((c) => c.id !== connectionId);
  const projectChannels = Object.fromEntries(
    Object.entries(yt.projectChannels ?? {}).filter(([, id]) => id !== connectionId),
  );
  const folderChannels = Object.fromEntries(
    Object.entries(yt.folderChannels ?? {}).filter(([, id]) => id !== connectionId),
  ) as Partial<Record<ChannelId, string>>;
  return {
    ...settings,
    youtube: { ...yt, channels, projectChannels, folderChannels },
  };
}

export function setProjectYouTubeChannel(
  settings: Settings,
  projectId: string,
  connectionId: string | null,
): Settings {
  const yt = normalizeYouTubeSettings(settings.youtube);
  if (!yt) return settings;
  const projectChannels = { ...(yt.projectChannels ?? {}) };
  if (connectionId) projectChannels[projectId] = connectionId;
  else delete projectChannels[projectId];
  return { ...settings, youtube: { ...yt, projectChannels } };
}

export function setFolderYouTubeChannel(
  settings: Settings,
  folderId: ChannelId,
  connectionId: string | null,
): Settings {
  const yt = normalizeYouTubeSettings(settings.youtube);
  if (!yt) return settings;
  const folderChannels = { ...(yt.folderChannels ?? {}) };
  if (connectionId) folderChannels[folderId] = connectionId;
  else delete folderChannels[folderId];
  return { ...settings, youtube: { ...yt, folderChannels } };
}

/** Opens YouTube account settings where you can create another channel on the same Google account. */
export const YOUTUBE_CREATE_CHANNEL_URL = "https://www.youtube.com/account";

/** List / switch between channels tied to the signed-in Google account. */
export const YOUTUBE_CHANNEL_SWITCHER_URL = "https://www.youtube.com/channel_switcher";
