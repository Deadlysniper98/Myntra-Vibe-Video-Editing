import React from "react";
import { Check } from "lucide-react";
import type { YouTubeChannelConnection } from "./settings";
import type { Settings } from "./settings";
import { getYouTubeChannels } from "./youtubeChannels";

const AVATAR_COLORS = [
  "#FF4444",
  "#e84a6f",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
];

export function channelInitials(title: string): string {
  const parts = title.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.slice(0, 2) ?? "YT").toUpperCase();
}

export function channelAvatarColor(title: string): string {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

interface YouTubeChannelAvatarProps {
  channel: Pick<YouTubeChannelConnection, "channelTitle" | "thumbnailUrl">;
  size?: number;
  selected?: boolean;
  className?: string;
}

export const YouTubeChannelAvatar: React.FC<YouTubeChannelAvatarProps> = ({
  channel,
  size = 32,
  selected = false,
  className = "",
}) => (
  <span
    className={`yt-ch-avatar${selected ? " yt-ch-avatar--selected" : ""} ${className}`.trim()}
    style={{
      width: size,
      height: size,
      ["--avatar-bg" as string]: channelAvatarColor(channel.channelTitle),
    }}
  >
    {channel.thumbnailUrl ? (
      <img src={channel.thumbnailUrl} alt="" />
    ) : (
      <span className="yt-ch-avatar-initials">{channelInitials(channel.channelTitle)}</span>
    )}
  </span>
);

/** Avatar + selection badge — shared by single- and multi-channel pickers. */
export const YouTubeChannelPickerAvatar: React.FC<YouTubeChannelAvatarProps> = ({
  channel,
  size = 36,
  selected = false,
  className = "",
}) => (
  <span className="yt-ch-picker-avatar-wrap">
    <YouTubeChannelAvatar channel={channel} size={size} selected={selected} className={className} />
    {selected ? (
      <span className="yt-ch-picker-check" aria-hidden>
        <Check className="h-3 w-3" strokeWidth={2.5} />
      </span>
    ) : null}
  </span>
);

const MAX_VISIBLE = 5;

interface YouTubeChannelStackProps {
  settings: Settings;
  onClick: () => void;
  title?: string;
}

export const YouTubeChannelStack: React.FC<YouTubeChannelStackProps> = ({
  settings,
  onClick,
  title,
}) => {
  const channels = getYouTubeChannels(settings);
  const connected = channels.length > 0;
  const visible = channels.slice(0, MAX_VISIBLE);
  const overflow = channels.length - MAX_VISIBLE;

  const defaultTitle = connected
    ? channels.map((c) => c.channelTitle).join(", ")
    : "Connect YouTube";

  return (
    <button
      type="button"
      className={`yt-channel-stack${connected ? " yt-channel-stack--connected" : ""}`}
      onClick={onClick}
      title={title ?? defaultTitle}
      aria-label={connected ? `YouTube · ${channels.length} channel(s)` : "Connect YouTube"}
    >
      {!connected ? (
        <span className="yt-channel-stack-disconnected">
          <img src="/brand-refs/youtube-mark.png" alt="" className="yt-channel-stack-yt-icon" />
        </span>
      ) : (
        <span className="yt-channel-stack-avatars" aria-hidden>
          {visible.map((ch, i) => (
            <span
              key={ch.id}
              className="yt-channel-stack-avatar"
              style={{
                zIndex: visible.length - i,
                ["--avatar-bg" as string]: channelAvatarColor(ch.channelTitle),
              }}
              title={ch.channelTitle}
            >
              {ch.thumbnailUrl ? (
                <img src={ch.thumbnailUrl} alt="" />
              ) : (
                <span className="yt-channel-stack-initials">{channelInitials(ch.channelTitle)}</span>
              )}
            </span>
          ))}
          {overflow > 0 ? (
            <span className="yt-channel-stack-overflow" style={{ zIndex: 0 }}>
              +{overflow}
            </span>
          ) : null}
        </span>
      )}
    </button>
  );
};
