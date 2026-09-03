import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Film,
  Trash2,
  X,
  Folder,
  Settings as SettingsIcon,
  Upload,
  CheckSquare,
  Square,
  Search,
} from "lucide-react";
import type { Project } from "./projects";
import type { Settings } from "./settings";
import { channelsSorted, type ChannelId, getChannel } from "./channels";
import { YouTubeChannelPicker } from "./YouTubeChannelPicker";
import { YouTubeChannelStack } from "./YouTubeChannelStack";
import { listYouTubeRenders } from "./ai/youtube";
import {
  buildProjectPublishSnapshot,
  type RenderFileInfo,
} from "./projectPublishStatus";
import { PublishStatusPills } from "./PublishStatusPills";
import {
  formatDuration,
  isProjectShort,
  projectCanUpload,
  projectContentTab,
  projectDurationSec,
  projectThumbUrl,
  resolveProjectComposition,
  type ContentTab,
} from "./projectMeta";
import { getYouTubePublishDefaults } from "./youtubePublishDefaults";
import {
  filterAndSortProjects,
  type ProjectSortKey,
} from "./projectListFilters";
import { FolderSortMenu } from "./FolderSortMenu";

function folderHeroProject(projects: Project[]): Project | null {
  const withThumb = projects.find((p) => projectThumbUrl(p));
  return withThumb ?? projects[0] ?? null;
}

interface ProjectsViewProps {
  projects: Project[];
  openFolder: ChannelId | null;
  onFolderChange: (id: ChannelId | null) => void;
  onOpen: (id: string) => void;
  onNew: (name: string, folderId: ChannelId) => void;
  onNewFromLink: (url: string, folderId: ChannelId) => void;
  onImport: (id: string) => void;
  onDelete: (id: string) => void;
  settings?: Settings;
  onSettingsChange?: (next: Settings) => void;
  onOpenSettings?: (section?: "api" | "youtube" | "layout") => void;
  onBulkUpload?: (projects: Project[]) => void;
}

const FolderIconCard: React.FC<{
  channelId: ChannelId;
  projects: Project[];
  onOpen: () => void;
}> = ({ channelId, projects, onOpen }) => {
  const channel = getChannel(channelId);
  const hero = folderHeroProject(projects);
  const coverFromChannel = channel.coverSrc ? `/${channel.coverSrc}` : null;
  const heroSrc = coverFromChannel ?? (hero ? projectThumbUrl(hero) : null);
  const heroClip = hero?.clips[0];
  const heroIsVideo =
    heroClip &&
    (heroClip.type.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(heroClip.url));
  const shortCount = projects.filter((p) => isProjectShort(p)).length;
  const videoCount = projects.length - shortCount;
  const total = projects.length;

  return (
    <button
      type="button"
      className="channel-folder-card"
      onClick={onOpen}
      title={`Open ${channel.name}`}
    >
      <div className="channel-folder-cover">
        {heroSrc ? (
          heroIsVideo ? (
            <video src={heroSrc} muted className="channel-folder-cover-img" />
          ) : (
            <img src={heroSrc} alt="" className="channel-folder-cover-img" />
          )
        ) : (
          <div className="channel-folder-cover-empty" aria-hidden>
            <Folder className="h-8 w-8" />
          </div>
        )}
        {total > 0 ? <span className="channel-folder-badge">{total}</span> : null}
      </div>

      <div className="channel-folder-body">
        <div className="channel-folder-row">
          <h2 className="channel-folder-name">{channel.name}</h2>
          <ChevronRight className="channel-folder-chevron h-4 w-4" />
        </div>
        <p className="channel-folder-tagline">{channel.tagline}</p>
        <div className="channel-folder-stats">
          {total === 0 ? (
            <span className="channel-folder-stat channel-folder-stat--empty">No videos yet</span>
          ) : (
            <>
              {videoCount > 0 ? (
                <span className="channel-folder-stat">
                  {videoCount} video{videoCount === 1 ? "" : "s"}
                </span>
              ) : null}
              {shortCount > 0 ? (
                <span className="channel-folder-stat">
                  {shortCount} Short{shortCount === 1 ? "" : "s"}
                </span>
              ) : null}
            </>
          )}
        </div>
      </div>
    </button>
  );
};

const ContentCard: React.FC<{
  project: Project;
  renderFiles: RenderFileInfo[];
  settings?: Settings;
  onOpen: () => void;
  onDelete?: () => void;
  selectable?: boolean;
  selected?: boolean;
  selectionMode?: boolean;
  onToggleSelect?: () => void;
}> = ({
  project,
  renderFiles,
  settings,
  onOpen,
  onDelete,
  selectable,
  selected,
  selectionMode,
  onToggleSelect,
}) => {
  const src = projectThumbUrl(project);
  const clip = project.clips[0];
  const isClipVideo =
    clip && (clip.type.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(clip.url));
  const comp = resolveProjectComposition(project);
  const vertical = isProjectShort(project);
  const durationSec = projectDurationSec(project);
  const title =
    comp ? getYouTubePublishDefaults(comp.id, project.name).title : project.name;
  const publishSnapshot = buildProjectPublishSnapshot(project, renderFiles);
  const quickSelect = Boolean(selectable && selectionMode);

  const handleThumbClick = () => {
    if (quickSelect) {
      onToggleSelect?.();
      return;
    }
    onOpen();
  };

  return (
    <article
      className={`content-card${vertical ? " content-card--short" : ""}${selected ? " content-card--selected" : ""}${quickSelect ? " content-card--selecting" : ""}`}
      data-selectable={selectable ? "true" : undefined}
    >
      <div className="content-card-media">
        {selectable ? (
          <button
            type="button"
            className="content-card-check"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.();
            }}
            title={selected ? "Deselect" : "Select for bulk upload"}
            aria-pressed={selected}
          >
            {selected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
          </button>
        ) : null}

        <button
          type="button"
          className="content-card-thumb"
          data-vertical={vertical ? "true" : undefined}
          onClick={handleThumbClick}
          onDoubleClick={quickSelect ? onOpen : undefined}
          title={quickSelect ? `${selected ? "Deselect" : "Select"} · double-click to open` : title}
        >
          {src ? (
            isClipVideo ? (
              <video src={src} muted className="content-card-img" />
            ) : (
              <img src={src} alt="" className="content-card-img" />
            )
          ) : (
            <span className="content-card-empty">
              <Film className="h-5 w-5" />
            </span>
          )}
          {durationSec != null ? (
            <span className="content-card-duration">{formatDuration(durationSec)}</span>
          ) : null}
          {vertical ? <span className="content-card-format">Short</span> : null}
          {comp && !vertical ? <span className="content-card-format">{comp.aspect}</span> : null}
        </button>

        {!project.builtin && onDelete ? (
          <button
            type="button"
            className="content-card-delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <div className="content-card-info">
        <button type="button" className="content-card-body" onClick={onOpen}>
          <h3 className="content-card-title">{title}</h3>
        </button>
        <PublishStatusPills
          snapshot={publishSnapshot}
          settings={settings}
          className="content-card-status"
        />
      </div>
    </article>
  );
};

const ContentNewCard: React.FC<{ onClick: () => void; label: string; vertical?: boolean }> = ({
  onClick,
  label,
  vertical,
}) => (
  <button
    type="button"
    className={`content-card content-card--new${vertical ? " content-card--short" : ""}`}
    onClick={onClick}
  >
    <div className="content-card-media">
      <div className="content-card-thumb content-card-thumb--new">
        <Plus className="h-6 w-6" />
      </div>
    </div>
    <div className="content-card-info content-card-info--new">
      <span className="content-card-title">{label}</span>
      <span className="content-card-desc">Add to this folder</span>
    </div>
  </button>
);

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  openFolder,
  onFolderChange,
  onOpen,
  onNew,
  onNewFromLink,
  onDelete,
  settings,
  onSettingsChange,
  onOpenSettings,
  onBulkUpload,
}) => {
  const [creatingFolder, setCreatingFolder] = useState<ChannelId | null>(null);
  const [name, setName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [contentTab, setContentTab] = useState<ContentTab>("videos");
  const [renderFiles, setRenderFiles] = useState<RenderFileInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<ProjectSortKey>("default");
  const deleting = projects.find((p) => p.id === deletingId) || null;
  const isPipelineFolder = creatingFolder === "clipped";

  const submitCreate = () => {
    if (!creatingFolder) return;
    if (isPipelineFolder) {
      if (!name.trim()) return;
      onNewFromLink(name.trim(), creatingFolder);
    } else {
      onNew(name, creatingFolder);
    }
    setName("");
    setCreatingFolder(null);
  };

  const openCreate = (folderId: ChannelId) => {
    setCreatingFolder(folderId);
    setName("");
  };

  const activeChannel = openFolder ? getChannel(openFolder) : null;
  const folderProjects = openFolder ? projects.filter((p) => p.folderId === openFolder) : [];

  const videoProjects = useMemo(
    () => folderProjects.filter((p) => projectContentTab(p) === "videos"),
    [folderProjects],
  );
  const shortProjects = useMemo(
    () => folderProjects.filter((p) => projectContentTab(p) === "shorts"),
    [folderProjects],
  );

  const visibleProjects = contentTab === "shorts" ? shortProjects : videoProjects;

  const projectOrderIndex = useMemo(() => {
    const map = new Map<string, number>();
    projects.forEach((p, i) => map.set(p.id, i));
    return map;
  }, [projects]);

  const filteredProjects = useMemo(
    () => filterAndSortProjects(visibleProjects, searchQuery, sortKey, renderFiles, projectOrderIndex),
    [visibleProjects, searchQuery, sortKey, renderFiles, projectOrderIndex],
  );

  const uploadableInFolder = folderProjects.filter((p) => projectCanUpload(p));
  const uploadableVisible = filteredProjects.filter((p) => projectCanUpload(p));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllUploadable = () => {
    setSelectedIds(new Set(uploadableVisible.map((p) => p.id)));
    setSelectionMode(true);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const exitSelectionMode = () => setSelectionMode(false);

  const openBulkDialog = () => {
    const batch =
      selectedIds.size > 0
        ? folderProjects.filter((p) => selectedIds.has(p.id))
        : uploadableVisible;
    if (batch.length > 0) onBulkUpload?.(batch);
  };

  useEffect(() => {
    setSelectedIds(new Set());
    setSelectionMode(false);
    setSearchQuery("");
  }, [openFolder]);

  useEffect(() => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, [contentTab]);

  useEffect(() => {
    if (!openFolder) return;
    void listYouTubeRenders()
      .then((files) => setRenderFiles(files))
      .catch(() => setRenderFiles([]));
  }, [openFolder, projects]);

  useEffect(() => {
    if (!openFolder) return;
    if (contentTab === "videos" && videoProjects.length === 0 && shortProjects.length > 0) {
      setContentTab("shorts");
    } else if (contentTab === "shorts" && shortProjects.length === 0 && videoProjects.length > 0) {
      setContentTab("videos");
    }
  }, [openFolder, contentTab, videoProjects.length, shortProjects.length]);

  const showVideosTab = videoProjects.length > 0;
  const showShortsTab = shortProjects.length > 0;
  const newLabel = contentTab === "shorts" ? "New Short" : "New video";

  return (
    <div className="projects">
      <header className="projects-head">
        {openFolder ? (
          <button
            type="button"
            className="projects-back"
            onClick={() => onFolderChange(null)}
            title="All folders"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        ) : (
          <div className="brand">
            <span className="spark">✦</span> Vibe
          </div>
        )}
        <div className="projects-head-main">
          <h1 className="projects-title">
            {activeChannel ? activeChannel.name : "Projects"}
          </h1>
          {!openFolder ? (
            <p className="projects-subtitle">Channel folders</p>
          ) : activeChannel ? (
            <p className="projects-subtitle">{activeChannel.tagline}</p>
          ) : null}
        </div>
        <div className="projects-head-actions">
          {settings && onOpenSettings ? (
            <YouTubeChannelStack
              settings={settings}
              onClick={() => onOpenSettings("youtube")}
            />
          ) : null}
          {onOpenSettings ? (
            <button
              type="button"
              className="projects-settings-btn"
              onClick={() => onOpenSettings("api")}
              title="Settings"
            >
              <SettingsIcon className="h-4 w-4" />
            </button>
          ) : null}
          {openFolder ? (
            <button
              type="button"
              className="project-folder-add projects-head-add"
              onClick={() => openCreate(openFolder)}
            >
              <Plus className="h-4 w-4" />
              New
            </button>
          ) : null}
          {openFolder && uploadableInFolder.length > 0 ? (
            <>
              <button
                type="button"
                className={`projects-select-btn${selectionMode ? " projects-select-btn--active" : ""}`}
                onClick={() => {
                  if (selectionMode) {
                    exitSelectionMode();
                  } else {
                    setSelectionMode(true);
                  }
                }}
                title={selectionMode ? "Exit select mode — clicks open videos again" : "Select multiple videos for bulk upload"}
              >
                {selectionMode ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                <span className="projects-bulk-btn-label">
                  {selectionMode ? "Done" : "Select"}
                </span>
              </button>
              <button
                type="button"
                className={`projects-bulk-btn${selectedIds.size > 0 ? " projects-bulk-btn--active" : ""}`}
                onClick={openBulkDialog}
                title={selectedIds.size > 0 ? "Upload selected" : "Bulk upload all on this tab"}
              >
                <Upload className="h-4 w-4" />
                <span className="projects-bulk-btn-label">
                  {selectedIds.size > 0 ? `Upload (${selectedIds.size})` : "Bulk upload"}
                </span>
              </button>
            </>
          ) : null}
        </div>
      </header>

      {!openFolder ? (
        <div className="projects-home">
          <div className="projects-home-intro">
            <p className="projects-home-lead">Where your videos live</p>
            <p className="projects-home-hint">
              Open a folder to edit, render, and publish. Each folder is a separate channel or series.
            </p>
          </div>
          <div className="folder-grid-main">
            {channelsSorted().map((channel) => (
              <FolderIconCard
                key={channel.id}
                channelId={channel.id}
                projects={projects.filter((p) => p.folderId === channel.id)}
                onOpen={() => onFolderChange(channel.id)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="folder-detail">
          {settings && onSettingsChange && openFolder ? (
            <div className="folder-yt-default">
              <YouTubeChannelPicker
                settings={settings}
                onChange={onSettingsChange}
                folderId={openFolder}
                label={`Default YouTube channel · ${activeChannel?.name}`}
                hint="All videos in this folder publish here unless a project picks its own."
                onNeedCredentials={() => onOpenSettings?.("youtube")}
              />
            </div>
          ) : null}

          {(showVideosTab || showShortsTab) && folderProjects.length > 0 ? (
            <nav className="content-tabs" aria-label="Content type">
              {showVideosTab ? (
                <button
                  type="button"
                  className="content-tab"
                  data-active={contentTab === "videos" ? "true" : undefined}
                  onClick={() => {
                    setContentTab("videos");
                    clearSelection();
                  }}
                >
                  Videos
                  <span className="content-tab-count">{videoProjects.length}</span>
                </button>
              ) : null}
              {showShortsTab ? (
                <button
                  type="button"
                  className="content-tab"
                  data-active={contentTab === "shorts" ? "true" : undefined}
                  onClick={() => {
                    setContentTab("shorts");
                    clearSelection();
                  }}
                >
                  Shorts
                  <span className="content-tab-count">{shortProjects.length}</span>
                </button>
              ) : null}
            </nav>
          ) : null}

          {(showVideosTab || showShortsTab) && folderProjects.length > 0 ? (
            <div className="folder-toolbar">
              <label className="folder-search">
                <Search className="folder-search-icon h-4 w-4" />
                <input
                  type="search"
                  className="folder-search-input"
                  placeholder={`Search ${contentTab === "shorts" ? "Shorts" : "videos"}…`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search videos"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    className="folder-search-clear"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </label>
              <FolderSortMenu value={sortKey} onChange={setSortKey} />
              {searchQuery || sortKey !== "default" ? (
                <span className="folder-toolbar-count">
                  {filteredProjects.length} of {visibleProjects.length}
                </span>
              ) : null}
            </div>
          ) : null}

          {folderProjects.length === 0 ? (
            <div className="folder-detail-empty">
              <Folder className="h-8 w-8" />
              <p>No videos in this folder yet.</p>
              <button type="button" className="pa-ghost" onClick={() => openCreate(openFolder)}>
                <Plus className="h-4 w-4" /> Add video
              </button>
            </div>
          ) : visibleProjects.length === 0 ? (
            <div className="folder-detail-empty">
              <p>No {contentTab === "shorts" ? "Shorts" : "videos"} in this folder yet.</p>
              <button type="button" className="pa-ghost" onClick={() => openCreate(openFolder)}>
                <Plus className="h-4 w-4" /> {newLabel}
              </button>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="folder-detail-empty">
              <p>No matches{searchQuery ? ` for “${searchQuery}”` : ""}.</p>
              <button
                type="button"
                className="pa-ghost"
                onClick={() => {
                  setSearchQuery("");
                  setSortKey("default");
                }}
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div
              className={`content-card-grid${contentTab === "shorts" ? " content-card-grid--shorts" : ""}${selectionMode ? " content-card-grid--selecting" : ""}`}
            >
              {filteredProjects.map((p) => (
                <ContentCard
                  key={p.id}
                  project={p}
                  renderFiles={renderFiles}
                  settings={settings}
                  onOpen={() => onOpen(p.id)}
                  onDelete={!p.builtin ? () => setDeletingId(p.id) : undefined}
                  selectable={projectCanUpload(p)}
                  selected={selectedIds.has(p.id)}
                  selectionMode={selectionMode}
                  onToggleSelect={() => toggleSelect(p.id)}
                />
              ))}
              <ContentNewCard
                label={newLabel}
                vertical={contentTab === "shorts"}
                onClick={() => openCreate(openFolder)}
              />
            </div>
          )}
        </div>
      )}

      {creatingFolder && (
        <div className="mini-overlay" onClick={() => setCreatingFolder(null)}>
          <div className="mini-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="mini-head">
              <h3>{isPipelineFolder ? "Paste a YouTube link" : `New video · ${getChannel(creatingFolder).name}`}</h3>
              <button className="mini-x" onClick={() => setCreatingFolder(null)} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mini-text project-folder-hint">
              {isPipelineFolder
                ? "Gemini watches the video and proposes the best moments — nothing downloads yet."
                : getChannel(creatingFolder).tagline}
            </p>
            <input
              autoFocus
              className="mini-input"
              placeholder={isPipelineFolder ? "https://www.youtube.com/watch?v=…" : "Video title"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitCreate()}
            />
            <div className="mini-actions">
              <button className="mini-cancel" onClick={() => setCreatingFolder(null)}>
                Cancel
              </button>
              <button className="mini-confirm" onClick={submitCreate} disabled={isPipelineFolder && !name.trim()}>
                {isPipelineFolder ? "Analyze" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <div className="mini-overlay" onClick={() => setDeletingId(null)}>
          <div className="mini-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="mini-head">
              <h3>Delete project?</h3>
              <button className="mini-x" onClick={() => setDeletingId(null)} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mini-text">“{deleting.name}” will be removed. This can’t be undone.</p>
            <div className="mini-actions">
              <button className="mini-cancel" onClick={() => setDeletingId(null)}>
                Cancel
              </button>
              <button
                className="mini-danger"
                onClick={() => {
                  onDelete(deleting.id);
                  setDeletingId(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedIds.size > 0 ? (
        <div className="bulk-upload-bar">
          <span>{selectedIds.size} selected</span>
          <button type="button" className="bulk-upload-bar-link" onClick={selectAllUploadable}>
            Select all on tab ({uploadableVisible.length})
          </button>
          <button type="button" className="bulk-upload-bar-link" onClick={clearSelection}>
            Clear
          </button>
          <button type="button" className="bulk-upload-bar-go" onClick={openBulkDialog}>
            <Upload className="h-4 w-4" /> Upload selected
          </button>
        </div>
      ) : selectionMode ? (
        <div className="bulk-upload-bar bulk-upload-bar--hint">
          <span>Click thumbnail to select · title opens video · double-click thumbnail to open</span>
          <button type="button" className="bulk-upload-bar-link" onClick={selectAllUploadable}>
            Select all ({uploadableVisible.length})
          </button>
          <button type="button" className="bulk-upload-bar-link" onClick={exitSelectionMode}>
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
};
