import React, { useEffect, useState } from "react";
import { ExternalLink, Loader2, RefreshCw, Save } from "lucide-react";
import type { Settings, YouTubeChannelConnection } from "./settings";
import {
  getYouTubeOAuthCreds,
} from "./youtubeChannels";
import {
  fetchYouTubeChannelDetails,
  listYouTubeChannelVideos,
  updateYouTubeChannel,
  type YouTubeChannelDetails,
  type YouTubeChannelVideo,
} from "./ai/youtube";
import { YouTubeChannelAvatar } from "./YouTubeChannelStack";
import { linkUploadsByTitle } from "./youtubeUploads";
import { getYouTubePublishDefaults } from "./youtubePublishDefaults";
import type { Project } from "./projects";

interface YouTubeChannelManagePanelProps {
  channel: YouTubeChannelConnection;
  settings: Settings;
  onChange: (next: Settings) => void;
  projects?: Project[];
}

export const YouTubeChannelManagePanel: React.FC<YouTubeChannelManagePanelProps> = ({
  channel,
  settings,
  onChange,
  projects = [],
}) => {
  const [details, setDetails] = useState<YouTubeChannelDetails | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videos, setVideos] = useState<YouTubeChannelVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [linkedCount, setLinkedCount] = useState<number | null>(null);

  const creds = getYouTubeOAuthCreds(settings);
  const auth = {
    clientId: creds.clientId,
    clientSecret: creds.clientSecret,
    refreshToken: channel.refreshToken,
  };

  const load = async () => {
    if (!auth.clientId || !auth.refreshToken) return;
    setLoading(true);
    setError("");
    try {
      const [ch, vids] = await Promise.all([
        fetchYouTubeChannelDetails(auth),
        listYouTubeChannelVideos({ ...auth, maxResults: 30 }),
      ]);
      setDetails(ch);
      setTitle(ch.title);
      setDescription(ch.description);
      setVideos(vids.videos);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id]);

  const onSave = async () => {
    if (!details) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const updated = await updateYouTubeChannel({
        ...auth,
        channelId: details.channelId,
        title: title.trim(),
        description,
      });
      setDetails((d) => (d ? { ...d, title: updated.title, description: updated.description } : d));
      const yt = settings.youtube;
      if (yt && "channels" in yt && Array.isArray(yt.channels)) {
        onChange({
          ...settings,
          youtube: {
            ...yt,
            channels: yt.channels.map((c) =>
              c.id === channel.id ? { ...c, channelTitle: updated.title } : c,
            ),
          },
        });
      }
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const onSyncProjects = () => {
    if (!channel.id) return;
    setSyncing(true);
    const folderProjects = projects.filter((p) => p.compositionId);
    const n = linkUploadsByTitle(
      channel.id,
      channel.youtubeChannelId ?? details?.channelId ?? "",
      videos.map((v) => ({ videoId: v.videoId, title: v.title, url: v.url ?? `https://youtu.be/${v.videoId}` })),
      folderProjects,
      (p) => getYouTubePublishDefaults(p.compositionId ?? "", p.name).title,
    );
    setLinkedCount(n);
    setSyncing(false);
  };

  const studioUrl = details?.channelId
    ? `https://studio.youtube.com/channel/${details.channelId}/editing/profile`
    : "https://studio.youtube.com";

  return (
    <div className="yt-channel-manage">
      <div className="yt-channel-manage-head">
        <YouTubeChannelAvatar channel={channel} size={48} />
        <div className="yt-channel-manage-head-text">
          <strong>{channel.channelTitle}</strong>
          {details?.customUrl ? (
            <span className="yt-channel-manage-handle">@{details.customUrl}</span>
          ) : null}
        </div>
        <button type="button" className="yt-channel-manage-refresh" onClick={load} disabled={loading} title="Refresh">
          <RefreshCw className={`h-4 w-4${loading ? " animate-spin" : ""}`} />
        </button>
      </div>

      <p className="yt-channel-manage-hint">
        Channel name & description can be edited here. Profile picture & banner must be changed in{" "}
        <a href={studioUrl} target="_blank" rel="noreferrer">
          YouTube Studio <ExternalLink className="inline h-3 w-3" />
        </a>{" "}
        (API limitation).
      </p>

      {error ? <p className="yt-channel-manage-error">{error}</p> : null}
      {error.includes("insufficient") || error.includes("scope") ? (
        <p className="yt-channel-manage-warn">
          Re-link this channel to grant channel-edit permissions.
        </p>
      ) : null}

      <label className="yt-channel-manage-label">Channel name</label>
      <input
        className="yt-channel-manage-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={loading || saving}
      />

      <label className="yt-channel-manage-label">Description</label>
      <textarea
        className="yt-channel-manage-input yt-channel-manage-textarea"
        rows={4}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        disabled={loading || saving}
      />

      <div className="yt-channel-manage-actions">
        <button type="button" className="upload-primary-btn" onClick={onSave} disabled={saving || loading}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save channel
        </button>
        {saved ? <span className="yt-channel-manage-saved">Saved</span> : null}
      </div>

      <div className="yt-channel-manage-divider" />

      <div className="yt-channel-manage-videos-head">
        <h4>Recent uploads on this channel</h4>
        {projects.length > 0 ? (
          <button
            type="button"
            className="yt-channel-manage-sync"
            onClick={onSyncProjects}
            disabled={syncing || videos.length === 0}
          >
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Match to projects
          </button>
        ) : null}
      </div>
      {linkedCount != null ? (
        <p className="yt-channel-manage-sync-result">Linked {linkedCount} project(s) by title.</p>
      ) : null}

      {loading ? (
        <p className="yt-channel-manage-muted">Loading…</p>
      ) : videos.length === 0 ? (
        <p className="yt-channel-manage-muted">No videos found yet.</p>
      ) : (
        <ul className="yt-channel-video-list">
          {videos.slice(0, 12).map((v) => (
            <li key={v.videoId}>
              {v.thumbnailUrl ? <img src={v.thumbnailUrl} alt="" /> : null}
              <div className="yt-channel-video-body">
                <span className="yt-channel-video-title">{v.title}</span>
                {v.publishedAt ? (
                  <span className="yt-channel-video-date">
                    {new Date(v.publishedAt).toLocaleDateString()}
                  </span>
                ) : null}
              </div>
              {v.url ? (
                <a href={v.url} target="_blank" rel="noreferrer" title="Open on YouTube">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
