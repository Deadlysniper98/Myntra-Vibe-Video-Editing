import React from "react";
import { Check, Loader2, X, AlertTriangle } from "lucide-react";
import { publishJobQueue, progressPct } from "./publishJobQueue";
import { usePublishJobs } from "./usePublishJobs";

interface PublishJobBarProps {
  /** inline = center of editor topbar; banner = full-width under projects header */
  variant?: "inline" | "banner";
  className?: string;
}

export const PublishJobBar: React.FC<PublishJobBarProps> = ({
  variant = "inline",
  className = "",
}) => {
  const jobs = usePublishJobs();
  const active = jobs.filter((j) => j.status === "running");
  const recent = jobs.filter((j) => j.status !== "running").slice(0, 3);

  if (active.length === 0 && recent.length === 0) return null;

  const primary = active[0] ?? recent[0];
  if (!primary) return null;

  const isRunning = primary.status === "running";
  const pct = progressPct(primary.progress);
  const label =
    primary.progress.message ||
    (primary.progress.stage === "rendering"
      ? `Rendering… ${primary.progress.renderProgress}%`
      : primary.progress.stage === "uploading"
        ? "Uploading…"
        : primary.status === "done"
          ? "Upload complete"
          : "Upload failed");

  return (
    <div
      className={`publish-job-bar publish-job-bar--${variant} ${className}`.trim()}
      data-status={primary.status}
      role="status"
      aria-live="polite"
    >
      <div className="publish-job-bar-inner">
        <span className="publish-job-bar-icon" aria-hidden>
          {isRunning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : primary.status === "done" ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5" />
          )}
        </span>
        <div className="publish-job-bar-copy">
          <span className="publish-job-bar-title">{primary.projectName}</span>
          <span className="publish-job-bar-stage">{label}</span>
        </div>
        {active.length > 1 ? (
          <span className="publish-job-bar-more">+{active.length - 1}</span>
        ) : null}
        {isRunning ? (
          <div className="publish-job-bar-track" aria-hidden>
            <div className="publish-job-bar-fill" style={{ width: `${pct}%` }} />
          </div>
        ) : null}
        {!isRunning ? (
          <button
            type="button"
            className="publish-job-bar-dismiss"
            onClick={() => publishJobQueue.dismissJob(primary.id)}
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
};
