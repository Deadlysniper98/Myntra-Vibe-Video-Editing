import React, { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Player, type PlayerRef } from "@remotion/player";
import {
  Sparkles,
  SlidersHorizontal,
  Settings as SettingsIcon,
  RotateCcw,
  Pencil,
  ThumbsUp,
  ThumbsDown,
  ChevronLeft,
  PanelLeftOpen,
  FolderOpen,
  Film,
  Download,
  Upload,
  LibraryBig,
  RefreshCw,
  ImagePlus,
  Mic,
} from "lucide-react";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import { COMPOSITIONS, aspectOptionsFor, type ManualProps, type CompMeta } from "./compositions";
import { DEFAULT_MANUAL_PROPS, serializeManualProps, deepCloneManual } from "./manualProps";
import { EffectGroup } from "./EffectGroup";
import { VideoControls } from "./VideoControls";
import { VideoToolbar } from "./VideoToolbar";
import { ComposedPromo } from "./ComposedPromo";
import { SettingsDialog } from "./SettingsDialog";
import { RenderDialog } from "./RenderDialog";
import { UploadDialog } from "./UploadDialog";
import { VideoPublishSidebar } from "./VideoPublishSidebar";
import { BulkUploadDialog } from "./BulkUploadDialog";
import { BulkUploadHud } from "./BulkUploadHud";
import { PublishJobBar } from "./PublishJobBar";
import { ProjectsView } from "./ProjectsView";
import { PipelineView } from "./PipelineView";
import { Library } from "./Library";
import { AssetStudio } from "./assets/AssetStudio";
import { VoiceoverPanel } from "./voice/VoiceoverPanel";
import {
  TEMPLATES,
  type Segment,
  type Template,
  type TimelineSeg,
  type DividerMark,
} from "./templates";
import { loadSettings, saveSettings, type Settings } from "./settings";
import { fetchYouTubeOAuthResult, YOUTUBE_OAUTH_STATE_KEY } from "./ai/youtube";
import { addYouTubeChannelFromOAuth, normalizeYouTubeSettings } from "./youtubeChannels";
import type { BackgroundChoice } from "../styles/backgrounds";
import type { ChannelId } from "./channels";
import { getChannel } from "./channels";
import {
  loadProjects,
  saveProjects,
  pickVideosFromFolder,
  filesToClips,
  createPipelineProject,
  PROMO_PROJECT_ID,
  type Project,
} from "./projects";
import { folderProjectsForNav } from "./projectMeta";

type Mode = "ai" | "manual";
type View = "projects" | "editor";
type Feedback = "like" | "dislike";

// The promo's scene boundaries (real frames) — the only openings a template can drop into.
const PROMO_DIVIDERS = [0, 165, 297, 437, 547, 675, 840, 955, 1060];

interface Snapshot {
  compId: string;
  manual: ManualProps;
}
interface ChatMsg {
  id: number;
  text: string;
  files: number;
  feedback?: Feedback;
  snapshot: Snapshot;
}

// ── A chat message with its small action row (edit · revert · like · dislike) ──
const ChatMessage: React.FC<{
  m: ChatMsg;
  onEdit: (m: ChatMsg) => void;
  onRevert: (m: ChatMsg) => void;
  onFeedback: (m: ChatMsg, f: Feedback) => void;
}> = ({ m, onEdit, onRevert, onFeedback }) => (
  <div className="msg">
    <div className="msg-text">{m.text}</div>
    <div className="msg-actions">
      <button className="msg-act" onClick={() => onEdit(m)} title="Edit & resend">
        <Pencil className="h-3 w-3" />
      </button>
      <button className="msg-act" onClick={() => onRevert(m)} title="Revert to before this message">
        <RotateCcw className="h-3 w-3" />
      </button>
      <button
        className="msg-act"
        data-active={m.feedback === "like" ? "like" : undefined}
        onClick={() => onFeedback(m, "like")}
        title="Good result"
      >
        <ThumbsUp className="h-3 w-3" />
      </button>
      <button
        className="msg-act"
        data-active={m.feedback === "dislike" ? "dislike" : undefined}
        onClick={() => onFeedback(m, "dislike")}
        title="Bad result"
      >
        <ThumbsDown className="h-3 w-3" />
      </button>
    </div>
  </div>
);

// ── Promo media: the Remotion player block (toolbar · video · controls) ──
const VideoArea: React.FC<{
  comp: CompMeta;
  playerComponent: React.FC<Record<string, unknown>>;
  playerInputProps: Record<string, unknown>;
  durationInFrames: number;
  playerRef: React.RefObject<PlayerRef | null>;
  onPickAspect: (compId: string) => void;
  aspectOptions: { aspect: string; compId: string }[];
  dividerMarks: DividerMark[];
  segments: TimelineSeg[];
  dragTemplate: Template | null;
  onAddSegment: (templateId: string, sec: number) => void;
  onRemoveSegment: (id: string) => void;
}> = ({
  comp,
  playerComponent,
  playerInputProps,
  durationInFrames,
  playerRef,
  onPickAspect,
  aspectOptions,
  dividerMarks,
  segments,
  dragTemplate,
  onAddSegment,
  onRemoveSegment,
}) => (
  <div
    className="video-block"
    data-vertical={comp.height > comp.width ? "true" : undefined}
    style={
      {
        "--ar": `${comp.width} / ${comp.height}`,
        "--ar-num": comp.width / comp.height,
      } as React.CSSProperties
    }
  >
    <VideoToolbar
      aspect={comp.aspect}
      label={comp.label}
      aspectOptions={aspectOptions}
      onPickAspect={onPickAspect}
    />
    <div className="player-shell">
      <Player
        ref={playerRef}
        component={playerComponent}
        inputProps={playerInputProps}
        durationInFrames={durationInFrames}
        fps={comp.fps}
        compositionWidth={comp.width}
        compositionHeight={comp.height}
        style={{ width: "100%", height: "100%" }}
        controls={false}
        autoPlay
        loop
        clickToPlay
        spaceKeyToPlayOrPause
        acknowledgeRemotionLicense
        numberOfSharedAudioTags={12}
      />
    </div>
    <VideoControls
      playerRef={playerRef}
      durationInFrames={durationInFrames}
      fps={comp.fps}
      dividerMarks={dividerMarks}
      segments={segments}
      dragTemplate={dragTemplate}
      onAddSegment={onAddSegment}
      onRemoveSegment={onRemoveSegment}
    />
  </div>
);

// ── User-project media: imported clips from a local folder ──
const ClipGrid: React.FC<{ project: Project; onImport: () => void }> = ({ project, onImport }) => (
  <div className="clip-area">
    <div className="clip-area-head">
      <span className="clip-area-title">
        {project.name} · {project.clips.length} clip{project.clips.length === 1 ? "" : "s"}
      </span>
      <button className="clip-import" onClick={onImport}>
        <FolderOpen className="h-4 w-4" /> Import clips
      </button>
    </div>
    {project.clips.length === 0 ? (
      <button className="clip-empty" onClick={onImport}>
        <Film className="h-7 w-7" />
        <span>Import a folder of videos to add input clips</span>
      </button>
    ) : (
      <div className="clip-grid">
        {project.clips.map((c) => (
          <div className="clip" key={c.id}>
            <video src={c.url} muted className="clip-video" />
            <span className="clip-name" title={c.name}>
              {c.name}
            </span>
          </div>
        ))}
      </div>
    )}
  </div>
);

export const App: React.FC = () => {
  const [view, setView] = useState<View>("projects"); // land on the project library first
  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  const [activeProjectId, setActiveProjectId] = useState(PROMO_PROJECT_ID);
  const [projectsFolderId, setProjectsFolderId] = useState<ChannelId | null>(null);

  const [mode, setMode] = useState<Mode>("ai");
  const [chatCollapsed, setChatCollapsed] = useState(true);
  const [compId, setCompId] = useState(COMPOSITIONS[0].id);
  const [manual, setManual] = useState<ManualProps>(DEFAULT_MANUAL_PROPS);
  const [frame, setFrame] = useState(0);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [promptText, setPromptText] = useState("");
  const [settings, setSettingsState] = useState<Settings>(() => loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<"api" | "youtube" | "layout">("api");
  const [renderOpen, setRenderOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [bulkUploadJobId, setBulkUploadJobId] = useState<string | null>(null);
  const [bulkUploadProjects, setBulkUploadProjects] = useState<Project[] | undefined>(undefined);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [assetStudioOpen, setAssetStudioOpen] = useState(false);
  const [voiceoverOpen, setVoiceoverOpen] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [dragTemplate, setDragTemplate] = useState<Template | null>(null);
  // Animated background for infographic compositions (null = classic dot-grid).
  const [background, setBackground] = useState<BackgroundChoice | null>(null);
  const segId = useRef(1);
  const playerRef = useRef<PlayerRef>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const msgId = useRef(1);

  const comp = useMemo(
    () => COMPOSITIONS.find((c) => c.id === compId) ?? COMPOSITIONS[0],
    [compId],
  );
  const dividerFrames = useMemo(
    () =>
      comp.id === "MyComp" || comp.id === "MyCompVertical"
        ? PROMO_DIVIDERS
        : [0, comp.durationInFrames],
    [comp],
  );
  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? projects[0],
    [projects, activeProjectId],
  );
  const isPromo = !!activeProject?.builtin;
  const publishCompId = activeProject?.compositionId ?? comp.id;
  const usePublishLayout = isPromo && mode === "ai";

  const folderNavProjects = useMemo(() => {
    if (!activeProject?.folderId) return [];
    return folderProjectsForNav(projects, activeProject.folderId);
  }, [projects, activeProject?.folderId]);

  const folderNavIndex = folderNavProjects.findIndex((p) => p.id === activeProjectId);
  const prevNavProject = folderNavIndex > 0 ? folderNavProjects[folderNavIndex - 1] : null;
  const nextNavProject =
    folderNavIndex >= 0 && folderNavIndex < folderNavProjects.length - 1
      ? folderNavProjects[folderNavIndex + 1]
      : null;

  const updateSettings = (next: Settings) => {
    setSettingsState(next);
    saveSettings(next);
  };

  const openBulkUploadNew = (selected: Project[]) => {
    setBulkUploadJobId(null);
    setBulkUploadProjects(selected);
    setBulkUploadOpen(true);
  };

  const openBulkUploadJob = (jobId: string) => {
    setBulkUploadJobId(jobId);
    setBulkUploadProjects(undefined);
    setBulkUploadOpen(true);
  };

  const bulkUploadChrome = (
    <>
      <BulkUploadHud onOpenJob={openBulkUploadJob} />
      <PublishJobBar variant="banner" />
      <BulkUploadDialog
        open={bulkUploadOpen}
        onClose={() => {
          setBulkUploadOpen(false);
          setBulkUploadJobId(null);
          setBulkUploadProjects(undefined);
        }}
        jobId={bulkUploadJobId}
        projects={bulkUploadProjects}
        settings={settings}
        onChangeSettings={updateSettings}
        onOpenSettings={() => {
          setBulkUploadOpen(false);
          setSettingsSection("youtube");
          setSettingsOpen(true);
        }}
      />
    </>
  );

  // Self-fill API keys + YouTube OAuth creds from the dev server's .env.local
  // (see /api/config in vite-plugins/ai-endpoints.mjs).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/config");
        if (!res.ok) return;
        const cfg = (await res.json()) as {
          google?: string;
          elevenlabs?: string;
          youtubeClientId?: string;
          youtubeClientSecret?: string;
        };
        if (cancelled) return;
        setSettingsState((s) => {
          const yt = normalizeYouTubeSettings(s.youtube);
          const nextClientId = yt?.clientId || cfg.youtubeClientId || "";
          const nextClientSecret = yt?.clientSecret || cfg.youtubeClientSecret || "";
          const nextGoogle = s.keys.google || cfg.google || "";
          const nextEleven = s.keys.elevenlabs || cfg.elevenlabs || "";
          const unchanged =
            nextGoogle === s.keys.google &&
            nextEleven === s.keys.elevenlabs &&
            nextClientId === (yt?.clientId ?? "") &&
            nextClientSecret === (yt?.clientSecret ?? "");
          if (unchanged) return s;
          const next: Settings = {
            ...s,
            keys: {
              ...s.keys,
              google: nextGoogle,
              elevenlabs: nextEleven,
            },
            youtube: {
              clientId: nextClientId,
              clientSecret: nextClientSecret,
              channels: yt?.channels ?? [],
              projectChannels: yt?.projectChannels ?? {},
              folderChannels: yt?.folderChannels ?? {},
            },
          };
          saveSettings(next);
          return next;
        });
      } catch {
        /* dev server unreachable — leave Settings as-is */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Complete OAuth when Google redirects back to the editor (popup fallback).
  useEffect(() => {
    const urlState = new URLSearchParams(window.location.search).get("youtube_oauth_state");
    if (!urlState) return;

    const clean = window.location.pathname + window.location.hash;
    window.history.replaceState({}, "", clean);

    let cancelled = false;
    (async () => {
      const result = await fetchYouTubeOAuthResult(urlState);
      if (cancelled || !result?.ok || !result.refreshToken) return;
      sessionStorage.removeItem(YOUTUBE_OAUTH_STATE_KEY);
      setSettingsState((s) => {
        const next = addYouTubeChannelFromOAuth(s, {
          refreshToken: result.refreshToken!,
          channelTitle: result.channelTitle,
          youtubeChannelId: result.youtubeChannelId,
          thumbnailUrl: result.thumbnailUrl,
          clientId: result.clientId || s.youtube?.clientId || "",
          clientSecret: result.clientSecret || s.youtube?.clientSecret || "",
        });
        saveSettings(next);
        return next;
      });
      setSettingsOpen(true);
      setSettingsSection("youtube");
    })();

    return () => {
      cancelled = true;
    };
  }, []);
  const updateProjects = (next: Project[]) => {
    setProjects(next);
    saveProjects(next);
  };

  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    const onFrame = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    p.addEventListener("frameupdate", onFrame as never);
    return () => p.removeEventListener("frameupdate", onFrame as never);
  }, [compId, mode, view, activeProjectId, settings.layout, segments.length]);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // ── Chat ──
  const handleSend = (message: string, files?: File[]) => {
    const text = message.trim();
    if (!text) return;
    const snapshot: Snapshot = { compId, manual: deepCloneManual(manual) };
    // Prepend serialized manual state so the AI sees all current prop values.
    const contextBlock = serializeManualProps(manual);
    const fullText = `${contextBlock}\n\n${text}`;
    setMessages((prev) => [
      ...prev,
      { id: msgId.current++, text: fullText, files: files?.length ?? 0, snapshot },
    ]);
  };
  const revertTo = (m: ChatMsg) => {
    setCompId(m.snapshot.compId);
    setManual(deepCloneManual(m.snapshot.manual));
  };
  const editMsg = (m: ChatMsg) => {
    revertTo(m);
    setPromptText(m.text); // drop the text back into the box to re-do
  };
  const setFeedback = (m: ChatMsg, f: Feedback) =>
    setMessages((prev) =>
      prev.map((x) => (x.id === m.id ? { ...x, feedback: x.feedback === f ? undefined : f } : x)),
    );

  // Drop a library template onto the timeline → a planned section segment.
  const addSegment = (templateId: string, sec: number) => {
    const t = TEMPLATES.find((x) => x.id === templateId);
    if (!t) return;
    setSegments((prev) => [
      ...prev,
      {
        id: `${templateId}-${segId.current++}`,
        templateId,
        name: t.name,
        startSec: Math.max(0, sec),
        durationSec: t.durationSec,
        color: t.color,
        synced: false,
      },
    ]);
  };
  const removeSegment = (id: string) => setSegments((prev) => prev.filter((s) => s.id !== id));

  // Free to drop placeholders; "Sync" runs the AI pass that fits them to the video — the
  // credit-consuming step. Requires a provider key (nudges to Settings if none).
  const syncSegments = () => {
    const hasKey = Object.values(settings.keys).some((k) => k && k.trim());
    if (!hasKey) {
      setSettingsOpen(true);
      return;
    }
    // TODO(ai-layer): actually run the per-segment AI sync (and tick up $ usage).
    setSegments((prev) => prev.map((s) => ({ ...s, synced: true })));
  };

  // ── Projects ──
  const openProject = (id: string) => {
    setActiveProjectId(id);
    const proj = projects.find((p) => p.id === id);
    if (proj?.folderId) setProjectsFolderId(proj.folderId);
    if (proj?.compositionId && COMPOSITIONS.some((c) => c.id === proj.compositionId)) {
      setCompId(proj.compositionId);
      setManual(DEFAULT_MANUAL_PROPS);
    }
    setChatCollapsed(true);
    setMode("ai");
    setView("editor");
  };
  const backToProjects = () => setView("projects");
  const newProject = (name: string, folderId: ChannelId) => {
    const fallback = `Untitled ${projects.filter((p) => !p.builtin).length + 1}`;
    const proj: Project = {
      id: `proj-${proj_seed()}`,
      name: name.trim() || fallback,
      folderId,
      clips: [],
    };
    updateProjects([...projects, proj]);
    openProject(proj.id);
  };
  const newProjectFromLink = (url: string, folderId: ChannelId) => {
    const proj = createPipelineProject(url, folderId);
    updateProjects([...projects, proj]);
    setActiveProjectId(proj.id);
    setProjectsFolderId(folderId);
    setChatCollapsed(true);
    setMode("ai");
    setView("editor");
  };
  const updatePipelineProject = (id: string, patch: Partial<Project>) => {
    updateProjects(projects.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };
  const deleteProject = (id: string) => {
    updateProjects(projects.filter((p) => p.id !== id));
    if (activeProjectId === id) setActiveProjectId(PROMO_PROJECT_ID);
  };
  const importClips = async (projectId: string) => {
    const files = await pickVideosFromFolder();
    if (files.length === 0) return;
    const clips = filesToClips(files);
    updateProjects(
      projects.map((p) => (p.id === projectId ? { ...p, clips: [...p.clips, ...clips] } : p)),
    );
  };

  const seconds = (comp.durationInFrames / comp.fps).toFixed(1);

  // Expanded (edited) timeline — each dropped segment inserts its duration, pushing later
  // content back. Drives both the composed player and the timeline ruler.
  const timeline = useMemo(() => {
    const f = comp.fps;
    const base = comp.durationInFrames;
    const sorted = [...segments].sort((a, b) => a.startSec - b.startSec);
    let offset = 0;
    const segs = sorted.map((s) => {
      const insertFrame = Math.round(s.startSec * f);
      const durFrames = Math.round(s.durationSec * f);
      const expandedStartSec = (insertFrame + offset) / f;
      offset += durFrames;
      return { ...s, insertFrame, durFrames, expandedStartSec };
    });
    const effectiveDuration = base + offset;
    const dividerMarks = dividerFrames.map((d) => ({
      originalFrame: d,
      expandedFrame:
        d + segs.filter((s) => s.insertFrame <= d).reduce((a, s) => a + s.durFrames, 0),
    }));
    return { segs, effectiveDuration, dividerMarks };
  }, [segments, comp, dividerFrames]);

  const usesComposed = isPromo && timeline.segs.length > 0;
  const playerComponent = (usesComposed ? ComposedPromo : comp.component) as React.FC<
    Record<string, unknown>
  >;
  // Must be a STABLE reference — the Player re-renders when inputProps identity changes,
  // and frameupdate events re-render App every frame. A fresh object each render would
  // make the composed Player loop ("Maximum update depth exceeded").
  const playerInputProps = useMemo<Record<string, unknown>>(
    () =>
      usesComposed
        ? {
            compId: comp.id,
            composed: timeline.segs.map((s) => ({
              id: s.id,
              templateId: s.templateId,
              insertFrame: s.insertFrame,
              durFrames: s.durFrames,
            })),
            baseDurationInFrames: comp.durationInFrames,
          }
        : {
            ...(manual as unknown as Record<string, unknown>),
            ...(background ? { background } : {}),
          },
    [usesComposed, timeline, comp, manual, background],
  );
  const effectiveDuration = usesComposed ? timeline.effectiveDuration : comp.durationInFrames;

  const media = isPromo ? (
    <VideoArea
      comp={comp}
      playerComponent={playerComponent}
      playerInputProps={playerInputProps}
      durationInFrames={effectiveDuration}
      playerRef={playerRef}
      onPickAspect={(id) => {
          // flushSync forces React to update the DOM synchronously — the new
          // composition mounts while we're still inside the click handler
          // (user-gesture context). Calling play() afterwards satisfies
          // Chrome's autoplay policy for the freshly-mounted composition.
          flushSync(() => setCompId(id));
          playerRef.current?.play();
        }}
      aspectOptions={aspectOptionsFor(comp.id)}
      dividerMarks={timeline.dividerMarks}
      segments={timeline.segs}
      dragTemplate={dragTemplate}
      onAddSegment={addSegment}
      onRemoveSegment={removeSegment}
    />
  ) : (
    <ClipGrid project={activeProject} onImport={() => importClips(activeProject.id)} />
  );

  const messageNodes = messages.map((m) => (
    <ChatMessage key={m.id} m={m} onEdit={editMsg} onRevert={revertTo} onFeedback={setFeedback} />
  ));
  const promptBox = (
    <PromptInputBox
      value={promptText}
      onValueChange={setPromptText}
      onSend={handleSend}
      placeholder="Describe an edit — “make the intro punchier”…"
    />
  );

  if (view === "projects") {
    return (
      <>
        <ProjectsView
          projects={projects}
          openFolder={projectsFolderId}
          onFolderChange={setProjectsFolderId}
          onOpen={openProject}
          onNew={newProject}
          onNewFromLink={newProjectFromLink}
          onImport={importClips}
          onDelete={deleteProject}
          settings={settings}
          onSettingsChange={updateSettings}
          onOpenSettings={(section = "api") => {
            setSettingsSection(section);
            setSettingsOpen(true);
          }}
          onBulkUpload={openBulkUploadNew}
        />
        {bulkUploadChrome}
        <SettingsDialog
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          onChange={updateSettings}
          compId="MyComp"
          folderId={projectsFolderId ?? undefined}
          initialSection={settingsSection}
          projects={projects}
        />
      </>
    );
  }

  if (activeProject?.kind === "pipeline") {
    return (
      <>
        <PipelineView
          project={activeProject}
          onBack={backToProjects}
          onUpdate={(patch) => updatePipelineProject(activeProject.id, patch)}
        />
        {bulkUploadChrome}
      </>
    );
  }

  const activeChannel = activeProject?.folderId ? getChannel(activeProject.folderId) : null;

  return (
    <div className="app" data-mode={mode}>
      <header className="topbar">
        <div className="topbar-left">
          <button
            className="back-btn"
            onClick={backToProjects}
            title={activeChannel ? `Back to ${activeChannel.name}` : "Back to folder"}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="brand brand--compact">
            <span className="spark">✦</span> Vibe
          </div>
          <div className="project-pill" title={activeProject?.name}>
            {activeChannel ? (
              <span className="project-pill-channel">{activeChannel.name}</span>
            ) : null}
            <span className="project-pill-name">{activeProject?.name}</span>
          </div>
        </div>
        <PublishJobBar variant="inline" />
        {isPromo && (
          <div className="topbar-right">
            <button
              className="icon-btn"
              data-active={libraryOpen}
              onClick={() => {
                setLibraryOpen((o) => !o);
                setAssetStudioOpen(false);
                setVoiceoverOpen(false);
              }}
              title="Template library"
            >
              <LibraryBig className="h-4 w-4" />
            </button>
            <button
              className="icon-btn"
              data-active={assetStudioOpen}
              onClick={() => {
                setAssetStudioOpen((o) => !o);
                setVoiceoverOpen(false);
                setLibraryOpen(false);
              }}
              title="AI asset studio — generate images with Nano Banana"
            >
              <ImagePlus className="h-4 w-4" />
            </button>
            <button
              className="icon-btn"
              data-active={voiceoverOpen}
              onClick={() => {
                setVoiceoverOpen((o) => !o);
                setAssetStudioOpen(false);
                setLibraryOpen(false);
              }}
              title="AI voiceover — ElevenLabs narration"
            >
              <Mic className="h-4 w-4" />
            </button>
            {segments.some((s) => !s.synced) && (
              <button
                className="sync-btn"
                onClick={syncSegments}
                title="Fit dropped templates to the video — uses your API credits"
              >
                <RefreshCw className="h-4 w-4" /> Sync {segments.filter((s) => !s.synced).length}
              </button>
            )}
            {!usePublishLayout ? (
              <>
                <button
                  className="render-btn"
                  onClick={() => setRenderOpen(true)}
                  title="Render / export video"
                >
                  <Download className="h-4 w-4" /> Render
                </button>
                <button
                  className="upload-btn"
                  onClick={() => setUploadOpen(true)}
                  title="Render and upload to YouTube"
                >
                  <Upload className="h-4 w-4" /> Upload
                </button>
              </>
            ) : null}
            <div className="mode-toggle" role="tablist" aria-label="Editing mode">
              <span className="thumb" data-mode={mode} />
              <button
                role="tab"
                aria-selected={mode === "ai"}
                data-active={mode === "ai"}
                onClick={() => setMode("ai")}
                title="AI editing"
              >
                <Sparkles className="h-4 w-4" />
              </button>
              <button
                role="tab"
                aria-selected={mode === "manual"}
                data-active={mode === "manual"}
                onClick={() => setMode("manual")}
                title="Manual editing"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </header>

      {isPromo && mode === "manual" ? (
        <div className="workspace">
          <aside className="panel panel-left">
            <h4 className="panel-title">Compositions</h4>
            <ul className="comp-list">
              {COMPOSITIONS.map((c) => (
                <li key={c.id}>
                  <button data-active={c.id === compId} onClick={() => setCompId(c.id)}>
                    <span className="comp-name">{c.label}</span>
                    <span className="comp-aspect">{c.aspect}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
          <section className="stage">{media}</section>
          <aside className="panel panel-right">
            <h4 className="panel-title">Frame</h4>
            <dl className="meta">
              <div>
                <dt>Size</dt>
                <dd>
                  {comp.width}×{comp.height}
                </dd>
              </div>
              <div>
                <dt>FPS</dt>
                <dd>{comp.fps}</dd>
              </div>
              <div>
                <dt>Length</dt>
                <dd>
                  {comp.durationInFrames}f · {seconds}s
                </dd>
              </div>
              <div>
                <dt>Playhead</dt>
                <dd>
                  {frame} / {comp.durationInFrames}
                </dd>
              </div>
            </dl>
            {/* ── Motion Blur ── */}
            <EffectGroup
              title="Motion Blur"
              badge={manual.motionBlur.motionBlur ? `${manual.motionBlur.shutterAngle}°` : "off"}
              defaultOpen
            >
              <label className="row-inline">
                <span>Enabled</span>
                <input
                  type="checkbox"
                  checked={manual.motionBlur.motionBlur}
                  onChange={(e) =>
                    setManual({ ...manual, motionBlur: { ...manual.motionBlur, motionBlur: e.target.checked } })
                  }
                />
              </label>
              <label className="row-inline">
                <span>Shutter <em>{manual.motionBlur.shutterAngle}°</em></span>
                <input
                  type="range" min={0} max={360} step={10}
                  value={manual.motionBlur.shutterAngle}
                  disabled={!manual.motionBlur.motionBlur}
                  onChange={(e) =>
                    setManual({ ...manual, motionBlur: { ...manual.motionBlur, shutterAngle: Number(e.target.value) } })
                  }
                />
              </label>
              <label className="row-inline">
                <span>Samples <em>{manual.motionBlur.samples}</em></span>
                <input
                  type="range" min={2} max={32} step={1}
                  value={manual.motionBlur.samples}
                  disabled={!manual.motionBlur.motionBlur}
                  onChange={(e) =>
                    setManual({ ...manual, motionBlur: { ...manual.motionBlur, samples: Number(e.target.value) } })
                  }
                />
              </label>
            </EffectGroup>

            {/* ── Color Grade ── */}
            <EffectGroup
              title="Color Grade"
              badge={
                manual.colorGrade.brightness !== 1 || manual.colorGrade.contrast !== 1 ||
                manual.colorGrade.saturation !== 1 || manual.colorGrade.hueRotate !== 0 ||
                manual.colorGrade.temperature !== 0 || manual.colorGrade.tintOpacity > 0
                  ? "edited" : "default"
              }
            >
              <label className="row-inline">
                <span>Brightness <em>{manual.colorGrade.brightness.toFixed(2)}</em></span>
                <input type="range" min={0} max={3} step={0.01}
                  value={manual.colorGrade.brightness}
                  onChange={(e) => setManual({ ...manual, colorGrade: { ...manual.colorGrade, brightness: Number(e.target.value) } })}
                />
              </label>
              <label className="row-inline">
                <span>Contrast <em>{manual.colorGrade.contrast.toFixed(2)}</em></span>
                <input type="range" min={0} max={3} step={0.01}
                  value={manual.colorGrade.contrast}
                  onChange={(e) => setManual({ ...manual, colorGrade: { ...manual.colorGrade, contrast: Number(e.target.value) } })}
                />
              </label>
              <label className="row-inline">
                <span>Saturation <em>{manual.colorGrade.saturation.toFixed(2)}</em></span>
                <input type="range" min={0} max={3} step={0.01}
                  value={manual.colorGrade.saturation}
                  onChange={(e) => setManual({ ...manual, colorGrade: { ...manual.colorGrade, saturation: Number(e.target.value) } })}
                />
              </label>
              <label className="row-inline">
                <span>Hue <em>{manual.colorGrade.hueRotate}°</em></span>
                <input type="range" min={-180} max={180} step={1}
                  value={manual.colorGrade.hueRotate}
                  onChange={(e) => setManual({ ...manual, colorGrade: { ...manual.colorGrade, hueRotate: Number(e.target.value) } })}
                />
              </label>
              <label className="row-inline">
                <span>Temperature <em>{manual.colorGrade.temperature > 0 ? `+${manual.colorGrade.temperature}` : manual.colorGrade.temperature}</em></span>
                <input type="range" min={-100} max={100} step={1}
                  value={manual.colorGrade.temperature}
                  onChange={(e) => setManual({ ...manual, colorGrade: { ...manual.colorGrade, temperature: Number(e.target.value) } })}
                />
              </label>
              <label className="row-inline">
                <span>Tint <em>{Math.round(manual.colorGrade.tintOpacity * 100)}%</em></span>
                <input type="color"
                  value={manual.colorGrade.tintColor}
                  onChange={(e) => setManual({ ...manual, colorGrade: { ...manual.colorGrade, tintColor: e.target.value } })}
                />
                <input type="range" min={0} max={1} step={0.01}
                  value={manual.colorGrade.tintOpacity}
                  onChange={(e) => setManual({ ...manual, colorGrade: { ...manual.colorGrade, tintOpacity: Number(e.target.value) } })}
                />
              </label>
            </EffectGroup>

            {/* ── Overlays ── */}
            <EffectGroup
              title="Overlays"
              badge={manual.overlays.vignetteStrength > 0 ? `vignette ${manual.overlays.vignetteStrength.toFixed(1)}` : "off"}
            >
              <label className="row-inline">
                <span>Vignette <em>{manual.overlays.vignetteStrength.toFixed(2)}</em></span>
                <input type="range" min={0} max={1} step={0.01}
                  value={manual.overlays.vignetteStrength}
                  onChange={(e) => setManual({ ...manual, overlays: { ...manual.overlays, vignetteStrength: Number(e.target.value) } })}
                />
              </label>
              <label className="row-inline">
                <span>V. Radius <em>{manual.overlays.vignetteRadius.toFixed(2)}</em></span>
                <input type="range" min={0.3} max={1} step={0.01}
                  value={manual.overlays.vignetteRadius}
                  onChange={(e) => setManual({ ...manual, overlays: { ...manual.overlays, vignetteRadius: Number(e.target.value) } })}
                />
              </label>
            </EffectGroup>

            {/* ── Transform ── */}
            <EffectGroup
              title="Transform"
              badge={
                manual.transform.scaleX !== 1 || manual.transform.scaleY !== 1 ||
                manual.transform.offsetX !== 0 || manual.transform.offsetY !== 0 ||
                manual.transform.rotation !== 0
                  ? "edited" : "default"
              }
            >
              <label className="row-inline">
                <span>Scale X <em>{manual.transform.scaleX.toFixed(2)}</em></span>
                <input type="range" min={0.1} max={3} step={0.01}
                  value={manual.transform.scaleX}
                  onChange={(e) => setManual({ ...manual, transform: { ...manual.transform, scaleX: Number(e.target.value) } })}
                />
              </label>
              <label className="row-inline">
                <span>Scale Y <em>{manual.transform.scaleY.toFixed(2)}</em></span>
                <input type="range" min={0.1} max={3} step={0.01}
                  value={manual.transform.scaleY}
                  onChange={(e) => setManual({ ...manual, transform: { ...manual.transform, scaleY: Number(e.target.value) } })}
                />
              </label>
              <label className="row-inline">
                <span>Offset X <em>{manual.transform.offsetX}%</em></span>
                <input type="range" min={-50} max={50} step={0.5}
                  value={manual.transform.offsetX}
                  onChange={(e) => setManual({ ...manual, transform: { ...manual.transform, offsetX: Number(e.target.value) } })}
                />
              </label>
              <label className="row-inline">
                <span>Offset Y <em>{manual.transform.offsetY}%</em></span>
                <input type="range" min={-50} max={50} step={0.5}
                  value={manual.transform.offsetY}
                  onChange={(e) => setManual({ ...manual, transform: { ...manual.transform, offsetY: Number(e.target.value) } })}
                />
              </label>
              <label className="row-inline">
                <span>Rotation <em>{manual.transform.rotation}°</em></span>
                <input type="range" min={-180} max={180} step={1}
                  value={manual.transform.rotation}
                  onChange={(e) => setManual({ ...manual, transform: { ...manual.transform, rotation: Number(e.target.value) } })}
                />
              </label>
            </EffectGroup>

            {/* ── Easing ── */}
            <EffectGroup title="Easing" badge={manual.easing.preset}>
              <div className="easing-presets">
                {(["SWIFT", "POP", "DRIFT", "PUSH_IN", "FAST_OUT"] as const).map((p) => (
                  <button
                    key={p}
                    className="easing-preset-btn"
                    data-active={manual.easing.preset === p}
                    onClick={() => setManual({ ...manual, easing: { ...manual.easing, preset: p } })}
                  >
                    {p.replace("_", " ")}
                  </button>
                ))}
              </div>
            </EffectGroup>

            {/* ── Audio ── */}
            <EffectGroup
              title="Audio"
              badge={`vol ${Math.round(manual.audio.masterVolume * 100)}%`}
              defaultOpen
            >
              <label className="row-inline">
                <span>Master <em>{Math.round(manual.audio.masterVolume * 100)}%</em></span>
                <input type="range" min={0} max={1} step={0.01}
                  value={manual.audio.masterVolume}
                  onChange={(e) => setManual({ ...manual, audio: { ...manual.audio, masterVolume: Number(e.target.value) } })}
                />
              </label>
              <label className="row-inline">
                <span>Music <em>{Math.round(manual.audio.musicVolume * 100)}%</em></span>
                <input type="range" min={0} max={1} step={0.01}
                  value={manual.audio.musicVolume}
                  onChange={(e) => setManual({ ...manual, audio: { ...manual.audio, musicVolume: Number(e.target.value) } })}
                />
              </label>
              <label className="row-inline">
                <span>SFX <em>{Math.round(manual.audio.sfxVolume * 100)}%</em></span>
                <input type="range" min={0} max={1} step={0.01}
                  value={manual.audio.sfxVolume}
                  onChange={(e) => setManual({ ...manual, audio: { ...manual.audio, sfxVolume: Number(e.target.value) } })}
                />
              </label>
            </EffectGroup>

            {/* ── Chroma Key ── */}
            <EffectGroup title="Chroma Key" badge={manual.chromaKey.enabled ? "on" : "off"}>
              <label className="row-inline">
                <span>Enabled</span>
                <input
                  type="checkbox"
                  checked={manual.chromaKey.enabled}
                  onChange={(e) => setManual({ ...manual, chromaKey: { ...manual.chromaKey, enabled: e.target.checked } })}
                />
              </label>
              <label className="row-inline">
                <span>Key Color</span>
                <input
                  type="color"
                  value={manual.chromaKey.keyColor}
                  disabled={!manual.chromaKey.enabled}
                  onChange={(e) => setManual({ ...manual, chromaKey: { ...manual.chromaKey, keyColor: e.target.value } })}
                />
              </label>
              <label className="row-inline">
                <span>Threshold <em>{manual.chromaKey.threshold.toFixed(2)}</em></span>
                <input type="range" min={0} max={1} step={0.01}
                  value={manual.chromaKey.threshold}
                  disabled={!manual.chromaKey.enabled}
                  onChange={(e) => setManual({ ...manual, chromaKey: { ...manual.chromaKey, threshold: Number(e.target.value) } })}
                />
              </label>
              <label className="row-inline">
                <span>Feather <em>{manual.chromaKey.feather}px</em></span>
                <input type="range" min={0} max={20} step={0.5}
                  value={manual.chromaKey.feather}
                  disabled={!manual.chromaKey.enabled}
                  onChange={(e) => setManual({ ...manual, chromaKey: { ...manual.chromaKey, feather: Number(e.target.value) } })}
                />
              </label>
            </EffectGroup>
          </aside>
        </div>
      ) : usePublishLayout ? (
        <div className="workspace" data-layout="publish">
          <aside className={`chat-panel${chatCollapsed ? " chat-panel--collapsed" : ""}`}>
            {chatCollapsed ? (
              <button
                type="button"
                className="chat-expand-btn"
                onClick={() => setChatCollapsed(false)}
                title="Expand AI chat"
                aria-label="Expand AI chat"
              >
                <PanelLeftOpen className="h-4 w-4" />
                <Sparkles className="h-3.5 w-3.5" />
              </button>
            ) : (
              <>
                <div className="chat-head">
                  <span>Chat</span>
                  <button
                    type="button"
                    className="chat-collapse-btn"
                    onClick={() => setChatCollapsed(true)}
                    title="Collapse chat"
                    aria-label="Collapse chat"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                </div>
                <div className="chat-scroll" ref={chatScrollRef}>
                  {messages.length === 0 ? (
                    <div className="chat-empty">
                      Describe an edit to get started. Each message can be reverted.
                    </div>
                  ) : (
                    messageNodes
                  )}
                </div>
                <div className="chat-input">{promptBox}</div>
              </>
            )}
          </aside>
          <section className="video-pane video-pane--publish">{media}</section>
          <VideoPublishSidebar
            settings={settings}
            onChangeSettings={updateSettings}
            compId={publishCompId}
            projectId={activeProjectId}
            projectName={activeProject?.name}
            folderId={activeProject?.folderId}
            thumbSrc={activeProject?.thumbSrc}
            width={comp.width}
            height={comp.height}
            fps={comp.fps}
            durationInFrames={comp.durationInFrames}
            props={comp.id === "TeamBuild" ? undefined : background ? { ...manual, background } : manual}
            onOpenRender={() => setRenderOpen(true)}
            onOpenSettings={() => {
              setSettingsSection("youtube");
              setSettingsOpen(true);
            }}
            prevProject={prevNavProject}
            nextProject={nextNavProject}
            navIndex={Math.max(0, folderNavIndex)}
            navTotal={folderNavProjects.length}
            onPrev={prevNavProject ? () => openProject(prevNavProject.id) : undefined}
            onNext={nextNavProject ? () => openProject(nextNavProject.id) : undefined}
          />
        </div>
      ) : settings.layout === "left-chat" ? (
        <div className="workspace" data-layout="left-chat">
          <aside className="chat-panel">
            <div className="chat-head">Chat</div>
            <div className="chat-scroll" ref={chatScrollRef}>
              {messages.length === 0 ? (
                <div className="chat-empty">
                  Describe an edit to get started. Each message can be reverted.
                </div>
              ) : (
                messageNodes
              )}
            </div>
            <div className="chat-input">{promptBox}</div>
          </aside>
          <section className="video-pane">{media}</section>
        </div>
      ) : (
        <div className="workspace" data-layout="middle-chat">
          <section
            className="middle-stage"
            style={{ ["--ar-num" as string]: comp.width / comp.height } as React.CSSProperties}
          >
            {media}
            <div className="prompt-zone">
              {messages.length > 0 && (
                <div className="prompt-log" ref={chatScrollRef}>
                  {messageNodes}
                </div>
              )}
              {promptBox}
            </div>
          </section>
        </div>
      )}

      <button
        className="settings-fab"
        onClick={() => {
          setSettingsSection("api");
          setSettingsOpen(true);
        }}
        aria-label="Open settings"
        title="Settings · API keys"
      >
        <SettingsIcon className="h-5 w-5" />
      </button>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={updateSettings}
        compId={publishCompId}
        projectId={activeProjectId}
        folderId={activeProject?.folderId}
        projectName={activeProject?.name}
        onOpenRender={() => {
          setSettingsOpen(false);
          setRenderOpen(true);
        }}
        initialSection={settingsSection}
        projects={projects}
      />

      <RenderDialog
        open={renderOpen}
        onClose={() => setRenderOpen(false)}
        compId={comp.id}
        projectId={activeProjectId}
        projectName={activeProject?.name}
        folderId={activeProject?.folderId}
        width={comp.width}
        height={comp.height}
        fps={comp.fps}
        durationInFrames={comp.durationInFrames}
        props={comp.id === "TeamBuild" ? undefined : background ? { ...manual, background } : manual}
        settings={settings}
        onOpenSettings={() => {
          setRenderOpen(false);
          setSettingsSection("youtube");
          setSettingsOpen(true);
        }}
      />

      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        compId={publishCompId}
        projectId={activeProjectId}
        projectName={activeProject?.name}
        folderId={activeProject?.folderId}
        thumbSrc={activeProject?.thumbSrc}
        width={comp.width}
        height={comp.height}
        fps={comp.fps}
        durationInFrames={comp.durationInFrames}
        props={comp.id === "TeamBuild" ? undefined : background ? { ...manual, background } : manual}
        settings={settings}
        onOpenSettings={() => {
          setUploadOpen(false);
          setSettingsSection("youtube");
          setSettingsOpen(true);
        }}
      />

      <Library
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onDragTemplate={setDragTemplate}
        background={background}
        onPickBackground={setBackground}
      />

      <AssetStudio open={assetStudioOpen} onClose={() => setAssetStudioOpen(false)} />
      <VoiceoverPanel open={voiceoverOpen} onClose={() => setVoiceoverOpen(false)} />
      {bulkUploadChrome}
    </div>
  );
};

// Small id helper (avoids Date.now collisions within a tick).
let _seed = 0;
function proj_seed() {
  _seed += 1;
  return _seed.toString(36);
}

