import React from "react";
import { Loader2, Plus, Video } from "lucide-react";
import type { Settings } from "./settings";
import { useYouTubeOAuthConnect } from "./useYouTubeOAuthConnect";

interface YouTubeAddChannelButtonProps {
  settings: Settings;
  onChange: (next: Settings) => void;
  /** Called when OAuth credentials are missing — e.g. open Settings → YouTube */
  onNeedCredentials?: () => void;
  className?: string;
  variant?: "primary" | "outline" | "ghost";
  label?: string;
  showManualRetry?: boolean;
}

export const YouTubeAddChannelButton: React.FC<YouTubeAddChannelButtonProps> = ({
  settings,
  onChange,
  onNeedCredentials,
  className = "",
  variant = "outline",
  label,
  showManualRetry = false,
}) => {
  const { connect, manualComplete, connecting, error, needsCredentials, hasChannels } =
    useYouTubeOAuthConnect(settings, onChange);

  const buttonLabel =
    label ?? (hasChannels ? "Link another channel to Vibe" : "Link channel to Vibe");

  const onClick = () => {
    if (needsCredentials) {
      onNeedCredentials?.();
      return;
    }
    void connect();
  };

  return (
    <div className={`yt-add-channel ${className}`.trim()}>
      <button
        type="button"
        className={`yt-add-channel-btn yt-add-channel-btn--${variant}`}
        onClick={onClick}
        disabled={connecting}
      >
        {connecting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : hasChannels ? (
          <Plus className="h-4 w-4" />
        ) : (
          <Video className="h-4 w-4" />
        )}
        {connecting ? "Signing in…" : buttonLabel}
      </button>
      {needsCredentials ? (
        <p className="yt-add-channel-hint">
          OAuth Client ID and Secret required —{" "}
          {onNeedCredentials ? (
            <button type="button" className="yt-add-channel-link" onClick={onNeedCredentials}>
              open YouTube settings
            </button>
          ) : (
            "add them in Settings → YouTube"
          )}
        </p>
      ) : null}
      {showManualRetry && connecting ? (
        <button type="button" className="yt-add-channel-manual" onClick={() => void manualComplete()}>
          I finished signing in — check connection
        </button>
      ) : null}
      {error ? <p className="yt-add-channel-error">{error}</p> : null}
    </div>
  );
};
