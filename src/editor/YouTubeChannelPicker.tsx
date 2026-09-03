import React from "react";
import type { Settings } from "./settings";
import type { ChannelId } from "./channels";
import {
  getYouTubeChannels,
  resolveYouTubeChannel,
  setFolderYouTubeChannel,
  setProjectYouTubeChannel,
} from "./youtubeChannels";
import { YouTubeChannelPickerAvatar } from "./YouTubeChannelStack";
import { YouTubeChannelActions } from "./YouTubeChannelActions";
import { YouTubeAddChannelButton } from "./YouTubeAddChannelButton";

interface YouTubeChannelPickerProps {
  settings: Settings;
  /** Persist selection to folder/project settings. Omit for ephemeral (upload) mode. */
  onChange?: (next: Settings) => void;
  projectId?: string;
  folderId?: ChannelId;
  /** Controlled connection id — upload override without persisting. */
  value?: string;
  onValueChange?: (connectionId: string) => void;
  label?: string;
  hint?: string;
  className?: string;
  disabled?: boolean;
  onNeedCredentials?: () => void;
}

export const YouTubeChannelPicker: React.FC<YouTubeChannelPickerProps> = ({
  settings,
  onChange,
  projectId,
  folderId,
  value,
  onValueChange,
  label = "Publish to channel",
  hint,
  className = "",
  disabled = false,
  onNeedCredentials,
}) => {
  const channels = getYouTubeChannels(settings);
  const resolved = resolveYouTubeChannel(settings, { projectId, folderId, connectionId: value });
  const scope = projectId ? "project" : folderId ? "folder" : null;
  const ephemeral = Boolean(onValueChange);
  const selectedId = value || resolved?.id || channels[0]?.id || "";

  if (!channels.length) {
    return (
      <div className={`yt-ch-picker ${className}`.trim()}>
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

  const persistSelect = (connectionId: string) => {
    if (!onChange) return;
    if (scope === "project" && projectId) {
      onChange(setProjectYouTubeChannel(settings, projectId, connectionId));
    } else if (scope === "folder" && folderId) {
      onChange(setFolderYouTubeChannel(settings, folderId, connectionId));
    }
  };

  const handleSelect = (connectionId: string) => {
    if (disabled) return;
    if (ephemeral) onValueChange!(connectionId);
    else persistSelect(connectionId);
  };

  const interactive = ephemeral || Boolean(scope);

  return (
    <div className={`yt-ch-picker ${className}`.trim()}>
      {label ? <span className="yt-ch-picker-label">{label}</span> : null}
      <div
        className="yt-ch-picker-row"
        role="listbox"
        aria-label={label}
        aria-disabled={disabled || !interactive ? true : undefined}
      >
        {channels.map((ch) => {
          const selected = ch.id === selectedId;
          return (
            <button
              key={ch.id}
              type="button"
              role="option"
              aria-selected={selected}
              disabled={disabled || !interactive}
              className={`yt-ch-picker-option${selected ? " yt-ch-picker-option--selected" : ""}`}
              onClick={() => handleSelect(ch.id)}
              title={ch.channelTitle}
            >
              <YouTubeChannelPickerAvatar channel={ch} size={36} selected={selected} />
              <span className="yt-ch-picker-name">{ch.channelTitle}</span>
            </button>
          );
        })}
      </div>
      {hint ? <span className="yt-ch-picker-hint">{hint}</span> : null}
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
