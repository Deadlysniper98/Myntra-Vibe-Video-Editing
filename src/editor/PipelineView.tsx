import React, { useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, KeyRound, RefreshCw, Sparkles } from "lucide-react";
import type { Project } from "./projects";
import { analyzeYouTubeVideo, type CaptionAudit } from "./ai/clipAnalysis";
import { loadSettings } from "./settings";

interface PipelineViewProps {
  project: Project;
  onBack: () => void;
  onUpdate: (patch: Partial<Project>) => void;
}

const ScoreBar: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="pipeline-score-bar">
    <span style={{ width: 40, flexShrink: 0 }}>{label}</span>
    <div className="pipeline-score-track">
      <div className="pipeline-score-fill" style={{ width: `${value}%` }} />
    </div>
    <span style={{ width: 24, textAlign: "right", color: "var(--ink-2)" }}>{value}</span>
  </div>
);

const CaptionAuditCard: React.FC<{ audit: CaptionAudit }> = ({ audit }) => {
  const clean = !audit.hasBurnedInText || audit.coveragePct < 15;
  return (
    <div
      className="ds-card"
      style={{
        marginBottom: 16,
        borderColor: clean ? "rgba(74, 222, 128, 0.25)" : "rgba(251, 191, 36, 0.25)",
        background: clean ? "rgba(74, 222, 128, 0.08)" : "rgba(251, 191, 36, 0.08)",
        color: clean ? "#86efac" : "#fcd34d",
        display: "flex",
        gap: 8,
        fontSize: "var(--text-xs)",
      }}
    >
      {clean ? (
        <CheckCircle2 className="h-4 w-4 shrink-0" style={{ marginTop: 2 }} />
      ) : (
        <AlertTriangle className="h-4 w-4 shrink-0" style={{ marginTop: 2 }} />
      )}
      <div>
        <p style={{ margin: 0, fontWeight: 600 }}>
          {clean
            ? "Clean footage — full subtitle freedom"
            : `Burned-in captions detected · ~${audit.coveragePct}% of runtime`}
        </p>
        <p style={{ margin: "4px 0 0", opacity: 0.85 }}>{audit.note}</p>
      </div>
    </div>
  );
};

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export const PipelineView: React.FC<PipelineViewProps> = ({ project, onBack, onUpdate }) => {
  const geminiKey = (loadSettings().keys.google ?? "").trim();
  const ranOnce = useRef(false);

  const runAnalysis = React.useCallback(async () => {
    if (!project.sourceUrl || !geminiKey) return;
    onUpdate({ pipelineStatus: "analyzing", pipelineError: undefined });
    try {
      const analysis = await analyzeYouTubeVideo({ url: project.sourceUrl, apiKey: geminiKey });
      onUpdate({ pipelineStatus: "clips-proposed", analysis });
    } catch (e) {
      onUpdate({ pipelineStatus: "error", pipelineError: e instanceof Error ? e.message : String(e) });
    }
  }, [project.sourceUrl, geminiKey, onUpdate]);

  useEffect(() => {
    if (ranOnce.current) return;
    ranOnce.current = true;
    if (project.pipelineStatus === "draft" && geminiKey) void runAnalysis();
  }, [project.pipelineStatus, geminiKey, runAnalysis]);

  return (
    <div className="pipeline-view">
      <header className="pipeline-view-header">
        <button type="button" className="back-btn" onClick={onBack} title="Back to folder">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {project.name}
          </div>
          <div className="ds-muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {project.sourceUrl}
          </div>
        </div>
        {project.pipelineStatus === "clips-proposed" && (
          <button type="button" className="ds-btn" onClick={() => void runAnalysis()} style={{ fontSize: "var(--text-xs)" }}>
            <RefreshCw className="h-3.5 w-3.5" /> Re-analyze
          </button>
        )}
      </header>

      <div className="pipeline-view-body">
        {!geminiKey && (
          <div className="ds-card ds-row" style={{ marginBottom: 16, fontSize: "var(--text-xs)", alignItems: "flex-start" }}>
            <KeyRound className="h-4 w-4 shrink-0" style={{ marginTop: 2, color: "var(--accent)" }} />
            <span>
              Add your <b>Google · Gemini</b> API key in Settings to analyze this video.
            </span>
          </div>
        )}

        {project.pipelineStatus === "analyzing" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "64px 0", textAlign: "center" }}>
            <RefreshCw className="h-6 w-6 animate-spin" style={{ color: "var(--accent)" }} />
            <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--ink-2)" }}>
              Gemini is watching the video and scoring candidate moments…
            </p>
            <p className="ds-muted">One call — audio, visuals, and Hindi hooks together.</p>
          </div>
        )}

        {project.pipelineStatus === "error" && (
          <div className="ds-card" style={{ borderColor: "rgba(248, 113, 113, 0.3)", background: "rgba(248, 113, 113, 0.08)", color: "#fca5a5" }}>
            <p style={{ margin: 0, fontWeight: 600 }}>Analysis failed</p>
            <p style={{ margin: "4px 0 0", opacity: 0.85 }}>{project.pipelineError}</p>
            <button
              type="button"
              className="ds-btn"
              style={{ marginTop: 12, fontSize: "var(--text-xs)" }}
              onClick={() => void runAnalysis()}
              disabled={!geminiKey}
            >
              <Sparkles className="h-3.5 w-3.5" /> Try again
            </button>
          </div>
        )}

        {project.pipelineStatus === "draft" && geminiKey && (
          <button type="button" className="ds-btn ds-btn--accent" style={{ margin: "0 auto", display: "flex" }} onClick={() => void runAnalysis()}>
            <Sparkles className="h-4 w-4" /> Analyze video
          </button>
        )}

        {project.pipelineStatus === "clips-proposed" && project.analysis && (
          <>
            <h2 style={{ margin: "0 0 4px", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--ink-2)" }}>
              {project.analysis.videoTitle}
            </h2>
            <p className="ds-muted" style={{ marginBottom: 12 }}>
              {project.analysis.clips.length} candidate moments, ranked by overall score. Downloading,
              Hindi voiceover, and assembly are the next phase.
            </p>
            <CaptionAuditCard audit={project.analysis.captionAudit} />
            <div className="ds-stack">
              {project.analysis.clips.map((c, i) => (
                <div key={i} className="pipeline-clip-card">
                  <div className="ds-row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontFamily: "ui-monospace, monospace", fontSize: "var(--text-xs)", color: "var(--mute)" }}>
                      {formatTime(c.startSec)}–{formatTime(c.endSec)}
                    </span>
                    <span className="ds-chip" style={{ color: "var(--accent)", borderColor: "rgba(255, 63, 108, 0.25)", background: "var(--accent-soft)" }}>
                      {c.overall}/100
                    </span>
                  </div>
                  <p style={{ margin: "0 0 8px", fontSize: "var(--text-sm)" }}>{c.rationale}</p>
                  <p className="ds-muted" style={{ marginBottom: 12 }} lang="hi">
                    {c.hookHi}
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
                    <ScoreBar label="Hook" value={c.scores.hook} />
                    <ScoreBar label="Flow" value={c.scores.flow} />
                    <ScoreBar label="Value" value={c.scores.value} />
                    <ScoreBar label="Trend" value={c.scores.trend} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
