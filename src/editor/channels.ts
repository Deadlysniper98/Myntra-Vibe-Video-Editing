export type ChannelId = string;

export interface ChannelTheme {
  width: number;
  height: number;
  fps: number;
  visualTone: string;
  voiceTone: string;
  ctaPatterns: string[];
  layout?: "cinematic" | "signal-flat";
  backgroundId?: string;
  accent?: string;
}

export interface Channel {
  id: ChannelId;
  name: string;
  tagline: string;
  sortOrder: number;
  theme: ChannelTheme;
  defaultCompositionId?: string;
  coverSrc?: string;
}

export const CHANNELS: Channel[] = [{
  id: "myntra",
  name: "Myntra",
  tagline: "MynnovAIte · brand & innovate promos",
  sortOrder: 0,
  defaultCompositionId: "MyComp",
  theme: {
    width: 1920,
    height: 1080,
    fps: 30,
    visualTone: "Bold Myntra brand motion with cinematic energy, speaker reels, and event promos.",
    voiceTone: "Confident, event-ready, punchy.",
    ctaPatterns: ["Register now", "Join us", "Learn more"],
  },
}];

export const CHANNEL_BY_ID: Record<string, Channel> = { myntra: CHANNELS[0] };
export function getChannel(id: ChannelId): Channel { return CHANNEL_BY_ID[id] ?? CHANNELS[0]; }
export function channelsSorted(): Channel[] { return [...CHANNELS]; }
export function channelBrief(id: ChannelId): string {
  const c = getChannel(id);
  return [`Channel: ${c.name} — ${c.tagline}`, `Canvas: ${c.theme.width}×${c.theme.height} @ ${c.theme.fps}fps`, `Visual: ${c.theme.visualTone}`, `Voice: ${c.theme.voiceTone}`, `CTAs: ${c.theme.ctaPatterns.join(" · ")}`].join("\n");
}


