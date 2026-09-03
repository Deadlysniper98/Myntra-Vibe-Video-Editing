import React from "react";
import { ExternalLink, Plus } from "lucide-react";
import type { Settings } from "./settings";
import {
  YOUTUBE_CHANNEL_SWITCHER_URL,
  YOUTUBE_CREATE_CHANNEL_URL,
} from "./youtubeChannels";
import { YouTubeAddChannelButton } from "./YouTubeAddChannelButton";

interface YouTubeChannelActionsProps {
  settings: Settings;
  onChange: (next: Settings) => void;
  onNeedCredentials?: () => void;
  className?: string;
  /** Show numbered steps (folder/settings). Compact in publish sidebar. */
  showSteps?: boolean;
  linkVariant?: "primary" | "outline" | "ghost";
}

export const YouTubeChannelActions: React.FC<YouTubeChannelActionsProps> = ({
  settings,
  onChange,
  onNeedCredentials,
  className = "",
  showSteps = true,
  linkVariant = "outline",
}) => {
  const openCreate = () => {
    window.open(YOUTUBE_CREATE_CHANNEL_URL, "_blank", "noopener,noreferrer");
  };

  const openSwitcher = () => {
    window.open(YOUTUBE_CHANNEL_SWITCHER_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <div className={`yt-channel-actions ${className}`.trim()}>
      {showSteps ? (
        <ol className="yt-channel-actions-steps">
          <li>
            <strong>Create</strong> a new channel on YouTube (Account settings) — same Google login, no new email.
          </li>
          <li>
            <strong>Switch</strong> to that channel in YouTube (profile → Switch account).
          </li>
          <li>
            <strong>Link</strong> it here so Vibe can publish to it.
          </li>
        </ol>
      ) : null}

      <div className="yt-channel-actions-row">
        <button type="button" className="yt-channel-actions-create" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Create channel on YouTube
          <ExternalLink className="h-3.5 w-3.5 yt-channel-actions-ext" aria-hidden />
        </button>
        <button type="button" className="yt-channel-actions-switch" onClick={openSwitcher}>
          Switch channel on YouTube
          <ExternalLink className="h-3.5 w-3.5 yt-channel-actions-ext" aria-hidden />
        </button>
      </div>

      <YouTubeAddChannelButton
        settings={settings}
        onChange={onChange}
        onNeedCredentials={onNeedCredentials}
        variant={linkVariant}
        label="Link channel to Vibe"
        showManualRetry
      />
    </div>
  );
};
