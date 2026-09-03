import React, { useEffect, useState } from "react";
import {
  X,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  PanelLeft,
  AlignCenter,
  SlidersHorizontal,
  Video,
} from "lucide-react";
import {
  PROVIDERS,
  type Settings,
  type ProviderId,
  type Layout,
} from "./settings";
import {
  getYouTubeChannels,
  getYouTubeOAuthCreds,
  hasYouTubeChannels,
  removeYouTubeChannel,
  resolveYouTubeChannel,
  setYouTubeOAuthCreds,
} from "./youtubeChannels";
import { YouTubePublishPanel } from "./YouTubePublishPanel";
import { YouTubeChannelPicker } from "./YouTubeChannelPicker";
import { YouTubeChannelAvatar } from "./YouTubeChannelStack";
import { YouTubeChannelManagePanel } from "./YouTubeChannelManagePanel";
import { YouTubeChannelActions } from "./YouTubeChannelActions";
import type { ChannelId } from "./channels";
import type { Project } from "./projects";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onChange: (next: Settings) => void;
  compId?: string;
  projectId?: string;
  folderId?: ChannelId;
  projectName?: string;
  onOpenRender?: () => void;
  initialSection?: Section;
  projects?: Project[];
}

type Section = "api" | "youtube" | "layout";

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: "api", label: "API Keys", icon: <KeyRound className="h-4 w-4" /> },
  { id: "youtube", label: "YouTube", icon: <Video className="h-4 w-4" /> },
  { id: "layout", label: "Layout", icon: <SlidersHorizontal className="h-4 w-4" /> },
];

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  open,
  onClose,
  settings,
  onChange,
  compId = "MyComp",
  projectId,
  folderId,
  projectName,
  onOpenRender,
  initialSection,
  projects = [],
}) => {
  const [section, setSection] = useState<Section>(initialSection ?? "api");
  const [revealed, setRevealed] = useState<Set<ProviderId>>(new Set());
  const [ytRevealed, setYtRevealed] = useState(false);

  useEffect(() => {
    if (open && initialSection) setSection(initialSection);
  }, [open, initialSection]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const setKey = (id: ProviderId, value: string) =>
    onChange({ ...settings, keys: { ...settings.keys, [id]: value } });
  const setLayout = (layout: Layout) => onChange({ ...settings, layout });
  const toggleReveal = (id: ProviderId) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const total = PROVIDERS.reduce((sum, p) => sum + (settings.usageUsd[p.id] ?? 0), 0);
  const ytCreds = getYouTubeOAuthCreds(settings);
  const ytChannels = getYouTubeChannels(settings);
  const ytConnected = hasYouTubeChannels(settings);
  const activeChannel = resolveYouTubeChannel(settings, { projectId, folderId });

  const setYouTubeCreds = (patch: { clientId?: string; clientSecret?: string }) => {
    onChange(setYouTubeOAuthCreds(settings, patch));
  };

  const redirectUri =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/youtube/oauth/callback`
      : "http://localhost:5173/api/youtube/oauth/callback";

  return (
    <div className="ds-overlay" onClick={onClose}>
      <div
        className={`ds-dialog ${section === "youtube" ? "ds-dialog--wide" : "ds-dialog--md"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <nav className="ds-dialog-nav">
          <div className="ds-dialog-nav-title">Settings</div>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className="ds-nav-item"
              data-active={section === s.id}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </nav>

        <div className="ds-dialog-body">
          <button
            type="button"
            onClick={onClose}
            className="ds-dialog-close"
            style={{ position: "absolute", right: 16, top: 16 }}
            aria-label="Close settings"
          >
            <X className="h-4 w-4" />
          </button>

          {section === "api" && (
            <>
              <div className="ds-row" style={{ justifyContent: "space-between", marginBottom: 12, paddingRight: 40 }}>
                <h3 className="ds-section-title">API Keys</h3>
                <span className="ds-muted">
                  Total spend <strong style={{ color: "var(--ink)" }}>${total.toFixed(2)}</strong>
                </span>
              </div>

              <div className="ds-stack">
                {PROVIDERS.map((p) => {
                  const value = settings.keys[p.id] ?? "";
                  const usage = settings.usageUsd[p.id] ?? 0;
                  const show = revealed.has(p.id);
                  return (
                    <div key={p.id} className="ds-card">
                      <div className="ds-row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                        <div className="ds-row">
                          <span className="ds-status-dot" data-on={Boolean(value)} />
                          <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{p.label}</span>
                        </div>
                        <span className="ds-muted" style={{ fontFamily: "ui-monospace, monospace" }}>
                          ${usage.toFixed(2)} used
                        </span>
                      </div>
                      <div className="ds-row">
                        <input
                          type={show ? "text" : "password"}
                          value={value}
                          placeholder={p.hint}
                          onChange={(e) => setKey(p.id, e.target.value)}
                          className="ds-field ds-field--mono"
                          style={{ flex: 1, minWidth: 0 }}
                          autoComplete="off"
                          spellCheck={false}
                        />
                        <button
                          type="button"
                          onClick={() => toggleReveal(p.id)}
                          className="ds-btn ds-btn--icon"
                          aria-label={show ? "Hide key" : "Show key"}
                        >
                          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <a
                          href={p.keysUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="ds-btn ds-btn--icon"
                          title="Get a key"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="ds-muted" style={{ marginTop: 12 }}>
                Keys are stored only in this browser (localStorage) and aren’t sent anywhere
                by Vibe yet. Usage totals fill in as you run prompts through a provider.
              </p>
            </>
          )}

          {section === "youtube" && (
            <>
              <h3 className="ds-section-title" style={{ marginBottom: 4, paddingRight: 40 }}>
                YouTube
              </h3>
              <p className="ds-muted" style={{ marginBottom: 16 }}>
                One Google account can own several YouTube channels. Create a new channel on
                YouTube (same email), switch to it there, then link it here so Vibe can publish.
                Assign linked channels per folder or per project below.
              </p>

              <YouTubeChannelActions
                settings={settings}
                onChange={onChange}
                linkVariant="primary"
                className="mb-4"
              />

              {ytConnected ? (
                <div className="ds-stack" style={{ marginBottom: 16 }}>
                  {ytChannels.map((ch) => (
                    <div key={ch.id} className="ds-row" style={{ fontSize: "var(--text-sm)" }}>
                      <YouTubeChannelAvatar channel={ch} size={36} />
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                        <b>{ch.channelTitle}</b>
                        {activeChannel?.id === ch.id ? (
                          <span className="ds-accent-label">active</span>
                        ) : null}
                      </span>
                      <button
                        type="button"
                        onClick={() => onChange(removeYouTubeChannel(settings, ch.id))}
                        className="ds-btn ds-btn--ghost"
                        style={{ fontSize: "var(--text-2xs)", padding: "4px 8px" }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              {ytConnected
                ? ytChannels.map((ch) => (
                    <div key={ch.id} style={{ marginBottom: 16 }}>
                      <YouTubeChannelManagePanel
                        channel={ch}
                        settings={settings}
                        onChange={onChange}
                        projects={projects}
                      />
                    </div>
                  ))
                : null}

              {(projectId || folderId) && ytConnected ? (
                <div style={{ marginBottom: 16 }}>
                  <YouTubeChannelPicker
                    settings={settings}
                    onChange={onChange}
                    projectId={projectId}
                    folderId={folderId}
                    label={
                      projectId
                        ? `Channel for “${projectName ?? "this project"}”`
                        : "Default channel for this folder"
                    }
                    hint={
                      projectId
                        ? "Overrides the folder default for this video only."
                        : "Used by all projects in this folder unless a project picks its own."
                    }
                  />
                </div>
              ) : null}

              <div className="ds-stack">
                <div className="ds-card">
                  <label className="ds-label">OAuth Client ID</label>
                  <input
                    value={ytCreds.clientId}
                    onChange={(e) => setYouTubeCreds({ clientId: e.target.value })}
                    placeholder="….apps.googleusercontent.com"
                    className="ds-field ds-field--mono"
                    style={{ marginBottom: 12 }}
                    spellCheck={false}
                  />
                  <label className="ds-label">OAuth Client Secret</label>
                  <div className="ds-row">
                    <input
                      type={ytRevealed ? "text" : "password"}
                      value={ytCreds.clientSecret}
                      onChange={(e) => setYouTubeCreds({ clientSecret: e.target.value })}
                      placeholder="GOCSPX-…"
                      className="ds-field ds-field--mono"
                      style={{ flex: 1, minWidth: 0 }}
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      onClick={() => setYtRevealed((v) => !v)}
                      className="ds-btn ds-btn--icon"
                      aria-label="Toggle secret"
                    >
                      {ytRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="ds-card ds-muted">
                  <p style={{ margin: "0 0 8px", fontWeight: 600, color: "var(--ink-2)" }}>
                    Google Cloud setup
                  </p>
                  <ol style={{ margin: 0, paddingLeft: 18 }}>
                    <li>Enable <b>YouTube Data API v3</b></li>
                    <li>Create <b>OAuth 2.0 Client ID</b> (Web application)</li>
                    <li>
                      Add redirect URI: <code style={{ color: "var(--ink-2)" }}>{redirectUri}</code>
                    </li>
                    <li>
                      OAuth consent screen → add scope{" "}
                      <code style={{ color: "var(--ink-2)" }}>youtube.upload</code>
                    </li>
                  </ol>
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noreferrer"
                    className="ds-link"
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8 }}
                  >
                    Open Google Cloud Console <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              {ytConnected ? (
                <YouTubePublishPanel
                  settings={settings}
                  onChangeSettings={onChange}
                  compId={compId}
                  projectId={projectId}
                  folderId={folderId}
                  projectName={projectName}
                  onOpenRender={onOpenRender}
                />
              ) : null}
            </>
          )}

          {section === "layout" && (
            <>
              <h3 className="ds-section-title" style={{ marginBottom: 4 }}>Layout</h3>
              <p className="ds-muted" style={{ marginBottom: 16 }}>How the chat sits with the video.</p>
              <div className="ds-layout-grid">
                {(
                  [
                    { id: "left-chat", label: "Left chat", desc: "Traditional sidebar", icon: <PanelLeft className="h-5 w-5" /> },
                    { id: "middle-chat", label: "Middle chat", desc: "Minimal, centered", icon: <AlignCenter className="h-5 w-5" /> },
                  ] as { id: Layout; label: string; desc: string; icon: React.ReactNode }[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setLayout(opt.id)}
                    className="ds-layout-option"
                    data-active={settings.layout === opt.id}
                  >
                    {opt.icon}
                    <span style={{ fontWeight: 600 }}>{opt.label}</span>
                    <span className="ds-muted">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

