import React from "react";
import type { Settings } from "./settings";
import { getYouTubeChannels } from "./youtubeChannels";
import type { ProjectPublishSnapshot } from "./projectPublishStatus";
import { renderStatusLabel } from "./projectPublishStatus";

function privacyLabel(privacy?: string): string {
  if (privacy === "public") return "Public";
  if (privacy === "private") return "Private";
  return "Unlisted";
}

function formatShortDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const Pill: React.FC<{ className: string; children: React.ReactNode }> = ({ className, children }) => (
  <span className={`publish-status-pill ${className}`}>
    <span className="publish-status-pill-dot" aria-hidden />
    {children}
  </span>
);

export const PublishStatusPills: React.FC<{
  snapshot: ProjectPublishSnapshot;
  settings?: Settings;
  className?: string;
}> = ({ snapshot, settings, className }) => {
  const channels = settings ? getYouTubeChannels(settings) : [];
  const renderLabel = renderStatusLabel(snapshot);

  return (
    <div className={`publish-status-pills${className ? ` ${className}` : ""}`}>
      <Pill className={`publish-status-pill--${snapshot.renderStatus}`}>{renderLabel}</Pill>

      {snapshot.youtubeUploads.length === 0 ? (
        <Pill className="publish-status-pill--muted">Not on YouTube</Pill>
      ) : (
        snapshot.youtubeUploads.map((u) => {
          const ch = channels.find((c) => c.id === u.channelConnectionId);
          const chName = ch?.channelTitle ?? "YouTube";
          const when = formatShortDate(u.uploadedAt);
          const privacy = privacyLabel(u.privacy);
          const label = when ? `${chName} · ${privacy} · ${when}` : `${chName} · ${privacy}`;
          return (
            <a
              key={u.channelConnectionId}
              href={u.url}
              target="_blank"
              rel="noreferrer"
              className={`publish-status-pill publish-status-pill--uploaded publish-status-pill--${u.privacy ?? "unlisted"}`}
              title={`${u.title} on ${chName}`}
            >
              <span className="publish-status-pill-dot" aria-hidden />
              <span className="publish-status-pill-text">{label}</span>
            </a>
          );
        })
      )}
    </div>
  );
};
