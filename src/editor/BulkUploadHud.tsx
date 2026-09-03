import React, { useState } from "react";
import { Upload, Loader2, ChevronDown, ChevronUp, X, Check, AlertTriangle } from "lucide-react";
import { bulkUploadQueue, type BulkUploadJob } from "./bulkUploadQueue";
import { useBulkUploadQueue } from "./useBulkUploadQueue";

interface BulkUploadHudProps {
  onOpenJob: (jobId: string) => void;
}

export const BulkUploadHud: React.FC<BulkUploadHudProps> = ({ onOpenJob }) => {
  const jobs = useBulkUploadQueue();
  const [panelOpen, setPanelOpen] = useState(false);
  const summary = bulkUploadQueue.getActiveSummary();

  const visibleJobs = jobs.filter((j) => j.status !== "cancelled");

  if (visibleJobs.length === 0) return null;

  const totalItems = visibleJobs.reduce((n, j) => n + j.items.length, 0);
  const doneItems = visibleJobs.reduce((n, j) => n + j.items.filter((it) => it.status === "done").length, 0);
  const isActive = summary.running > 0 || summary.pending > 0 || visibleJobs.some((j) => j.status === "queued" || j.status === "running");

  const jobProgress = (job: BulkUploadJob) => {
    const done = job.items.filter((it) => it.status === "done").length;
    const failed = job.items.filter((it) => it.status === "error").length;
    const active = job.items.find((it) => it.status === "active");
    return { done, total: job.items.length, failed, active };
  };

  return (
    <div className="bulk-upload-hud" data-open={panelOpen ? "true" : undefined}>
      <button
        type="button"
        className="bulk-upload-hud-pill"
        onClick={() => setPanelOpen((o) => !o)}
        title="Bulk upload progress"
      >
        {isActive ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        <span className="bulk-upload-hud-pill-text">
          {isActive
            ? `Uploading ${doneItems}/${totalItems}`
            : `${doneItems} uploaded`}
        </span>
        {panelOpen ? <ChevronUp className="h-3.5 w-3.5 opacity-60" /> : <ChevronDown className="h-3.5 w-3.5 opacity-60" />}
      </button>

      {panelOpen ? (
        <div className="bulk-upload-hud-panel">
          <div className="bulk-upload-hud-panel-head">
            <strong>Upload queue</strong>
            <button type="button" className="bulk-upload-hud-close" onClick={() => setPanelOpen(false)} aria-label="Close">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <ul className="bulk-upload-hud-jobs">
            {visibleJobs.map((job) => {
              const { done, total, failed, active } = jobProgress(job);
              return (
                <li key={job.id} className="bulk-upload-hud-job">
                  <button type="button" className="bulk-upload-hud-job-btn" onClick={() => onOpenJob(job.id)}>
                    <span className="bulk-upload-hud-job-title">{job.label}</span>
                    <span className="bulk-upload-hud-job-meta">
                      {job.status === "running" || job.status === "queued" ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin inline" /> {done}/{total}
                          {active ? ` · ${active.message}` : ""}
                        </>
                      ) : job.status === "draft" ? (
                        "Draft — not started"
                      ) : (
                        <>
                          <Check className="h-3 w-3 inline" /> {done}/{total}
                          {failed ? ` · ${failed} failed` : ""}
                        </>
                      )}
                    </span>
                  </button>
                  {job.status === "done" || job.status === "cancelled" ? (
                    <button
                      type="button"
                      className="bulk-upload-hud-dismiss"
                      onClick={() => bulkUploadQueue.dismissJob(job.id)}
                      title="Dismiss"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  ) : job.status === "draft" ? (
                    <button
                      type="button"
                      className="bulk-upload-hud-dismiss"
                      onClick={() => bulkUploadQueue.cancelJob(job.id)}
                      title="Cancel draft"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {summary.failed > 0 ? (
            <p className="bulk-upload-hud-warn">
              <AlertTriangle className="h-3.5 w-3.5 inline" /> {summary.failed} failed — open batch to review
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
