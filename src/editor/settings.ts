// Client-side settings for the Vibe editor — persisted to localStorage. No backend
// yet, so API keys live only in this browser and are never sent anywhere by Vibe
// itself. (For a shipped multi-user product these would move server-side.)

export type ProviderId = "openai" | "anthropic" | "google" | "cloudflare" | "elevenlabs";

export interface ProviderMeta {
  id: ProviderId;
  label: string;
  hint: string; // placeholder / key-format hint
  keysUrl: string; // where to mint a key
}

export const PROVIDERS: ProviderMeta[] = [
  { id: "openai", label: "OpenAI", hint: "sk-…", keysUrl: "https://platform.openai.com/api-keys" },
  { id: "anthropic", label: "Anthropic · Claude", hint: "sk-ant-…", keysUrl: "https://console.anthropic.com/settings/keys" },
  { id: "google", label: "Google · Gemini", hint: "AIza…", keysUrl: "https://aistudio.google.com/app/apikey" },
  { id: "cloudflare", label: "Cloudflare · Workers AI", hint: "API token…", keysUrl: "https://dash.cloudflare.com/profile/api-tokens" },
  { id: "elevenlabs", label: "ElevenLabs · Voice", hint: "xi-…", keysUrl: "https://elevenlabs.io/app/settings/api-keys" },
];

// Two layouts: "left-chat" = a traditional chat sidebar beside the video;
// "middle-chat" = a minimal centered layout (video with the prompt below it).
export type Layout = "left-chat" | "middle-chat";

import type { ChannelId } from "./channels";

export interface YouTubeChannelConnection {
  id: string;
  youtubeChannelId?: string;
  channelTitle: string;
  thumbnailUrl?: string;
  refreshToken: string;
  connectedAt: string;
}

export interface YouTubeSettings {
  clientId: string;
  clientSecret: string;
  channels: YouTubeChannelConnection[];
  /** Per-project YouTube destination (builtin + user projects). */
  projectChannels?: Record<string, string>;
  /** Default channel for all projects in a folder unless overridden. */
  folderChannels?: Partial<Record<ChannelId, string>>;
}

/** @deprecated Legacy single-channel blob — migrated on load. */
export interface YouTubeAuth {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  channelTitle?: string;
  connectedAt?: string;
  youtubeChannelId?: string;
  channels?: YouTubeChannelConnection[];
  projectChannels?: Record<string, string>;
  folderChannels?: Partial<Record<ChannelId, string>>;
}

export interface Settings {
  keys: Partial<Record<ProviderId, string>>;
  // Estimated $ spent per provider — populated once prompts run through Vibe.
  usageUsd: Partial<Record<ProviderId, number>>;
  layout: Layout;
  /** YouTube OAuth — shared client creds + multiple channel connections. */
  youtube?: YouTubeSettings | YouTubeAuth;
}

import { normalizeYouTubeSettings } from "./youtubeChannels";

const STORAGE_KEY = "vibe.settings.v1";
const DEFAULTS: Settings = { keys: {}, usageUsd: {}, layout: "left-chat" };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      keys: { ...parsed.keys },
      usageUsd: { ...parsed.usageUsd },
      layout: parsed.layout ?? "left-chat",
      youtube: normalizeYouTubeSettings(parsed.youtube),
    };
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable — keep in-memory only */
  }
}
