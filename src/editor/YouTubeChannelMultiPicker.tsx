import React from "react";
import type { Settings } from "./settings";
import { getYouTubeChannels } from "./youtubeChannels";
import { YouTubeChannelPickerAvatar } from "./YouTubeChannelStack";
import { YouTubeChannelActions } from "./YouTubeChannelActions";
import { YouTubeAddChannelButton } from "./YouTubeAddChannelButton";

interface YouTubeChannelMultiPickerProps {
  settings: Settings;
  values: string[];
  onValuesChange: (connectionIds: string[]) => void;
  /** Required to add new channels inline */
  onChange?: (next: Settings) => void;
  onNeedCredentials?: () => void;
  label?: string;
  hint?: string;
  className?: string;
  disabled?: boolean;
  /** Show channel name beside avatar (default true). */
  showNames?: boolean;
  /** Channel connection ids that already have an upload for this project. */
  uploadedChannelIds?: string[];
}

export const YouTubeChannelMultiPicker: React.FC<YouTubeChannelMultiPickerProps> = ({
  settings,
  values,
  onValuesChange,
  label = "Publish to channels",
  hint = "Select one or more channels. Each video uploads to every selected channel.",
  className = "",
  disabled = false,
  showNames = true,
  onChange,
  onNeedCredentials,
  uploadedChannelIds = [],
}) => {
  const channels = getYouTubeChannels(settings);
  const selectedSet = new Set(values);
  const uploadedSet = new Set(uploadedChannelIds);

  if (!channels.length) {
    return (
      <div className={`yt-ch-picker yt-ch-picker--multi ${className}`.trim()}>
        {label ? <span className="yt-ch-picker-label">{label}</span> : null}
        {onChange ? (
          <YouTubeChannelActions
            settings={settings}
            onChange={onChange}
            onNeedCredentials={onNeedCredentials}
            linkVariant="primary"
          />
        ) : (
          <p className="yt-ch-picker-empty">
            Connect at least one YouTube channel in Settings → YouTube.
          </p>
        )}
      </div>
    );
  }

  const toggle = (connectionId: string) => {
    if (disabled) return;
    const next = new Set(selectedSet);
    if (next.has(connectionId)) {
      if (next.size <= 1) return;
      next.delete(connectionId);
    } else {
      next.add(connectionId);
    }
    onValuesChange(channels.filter((c) => next.has(c.id)).map((c) => c.id));
  };

  return (
    <div className={`yt-ch-picker yt-ch-picker--multi ${className}`.trim()}>
      {label ? <span className="yt-ch-picker-label">{label}</span> : null}
      <div className="yt-ch-picker-row" role="group" aria-label={label}>
        {channels.map((ch) => {
          const selected = selectedSet.has(ch.id);
          const alreadyUploaded = uploadedSet.has(ch.id);
          return (
            <button
              key={ch.id}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              className={`yt-ch-picker-option yt-ch-picker-option--multi${selected ? " yt-ch-picker-option--selected" : ""}${alreadyUploaded ? " yt-ch-picker-option--uploaded" : ""}`}
              onClick={() => toggle(ch.id)}
              title={
                alreadyUploaded
                  ? `${ch.channelTitle} — already uploaded (select to upload again)`
                  : selected
                    ? `Remove ${ch.channelTitle}`
                    : `Add ${ch.channelTitle}`
              }
            >
              <YouTubeChannelPickerAvatar channel={ch} size={36} selected={selected} />
              {showNames ? (
                <span className="yt-ch-picker-copy">
                  <span className="yt-ch-picker-name">{ch.channelTitle}</span>
                  {alreadyUploaded ? (
                    <span className="yt-ch-picker-uploaded-badge">Already uploaded</span>
                  ) : null}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {hint ? <span className="yt-ch-picker-hint">{hint}</span> : null}
      {values.length > 1 ? (
        <span className="yt-ch-picker-count">{values.length} channels selected</span>
      ) : null}
      {onChange ? (
        <YouTubeAddChannelButton
          settings={settings}
          onChange={onChange}
          onNeedCredentials={onNeedCredentials}
          variant="ghost"
          label="Link another channel to Vibe"
        />
      ) : null}
    </div>
  );
};
