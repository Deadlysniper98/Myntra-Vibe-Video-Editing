import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { PlayerRef } from "@remotion/player";
import type { TimelineSeg, DividerMark, Template } from "./templates";

// Seconds between major (labelled) ticks. The zoom popup steps through these.
export const ZOOM_LEVELS = [1, 5, 10, 30];
const MAJOR_PX = 120;

const tc = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const hexToRgba = (hex: string, a: number) => {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

interface TimelineProps {
  playerRef: React.RefObject<PlayerRef | null>;
  durationInFrames: number; // EXPANDED (edited) duration
  fps: number;
  zoom: number;
  dividerMarks?: DividerMark[]; // section openings, positioned on the expanded timeline
  segments?: TimelineSeg[];
  dragTemplate?: Template | null;
  onAddSegment?: (templateId: string, sec: number) => void; // sec is the ORIGINAL opening time
  onRemoveSegment?: (id: string) => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  playerRef,
  durationInFrames,
  fps,
  zoom,
  dividerMarks = [],
  segments = [],
  dragTemplate,
  onAddSegment,
  onRemoveSegment,
}) => {
  const [frame, setFrame] = useState(0);
  const [hoverMark, setHoverMark] = useState<DividerMark | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    const onFrame = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    p.addEventListener("frameupdate", onFrame as never);
    setFrame(p.getCurrentFrame());
    return () => p.removeEventListener("frameupdate", onFrame as never);
  }, [playerRef]);

  const secPerMajor = ZOOM_LEVELS[zoom] ?? 5;
  const pxPerSec = MAJOR_PX / secPerMajor;
  const durationSec = durationInFrames / fps;
  const width = Math.max(0, durationSec * pxPerSec);
  const playheadX = (frame / fps) * pxPerSec;

  const majors: number[] = [];
  for (let t = 0; t <= durationSec + 1e-6; t += secPerMajor) majors.push(t);
  const minorStep = secPerMajor / 5;
  const minors: number[] = [];
  for (let t = 0; t <= durationSec + 1e-6; t += minorStep) minors.push(t);

  const secAtClientX = (clientX: number) => {
    const el = rulerRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(durationSec, (clientX - rect.left) / pxPerSec));
  };
  const nearestMark = (sec: number): DividerMark | null => {
    if (dividerMarks.length === 0) return null;
    return dividerMarks.reduce((best, m) =>
      Math.abs(m.expandedFrame / fps - sec) < Math.abs(best.expandedFrame / fps - sec) ? m : best,
    );
  };

  const seekToClientX = (clientX: number) => {
    playerRef.current?.seekTo(Math.round(secAtClientX(clientX) * fps));
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      const sc = scrollRef.current;
      if (!sc) return;
      const startX = e.clientX;
      const startScroll = sc.scrollLeft;
      const move = (ev: MouseEvent) => {
        sc.scrollLeft = startScroll - (ev.clientX - startX);
      };
      const up = () => {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
      return;
    }
    if (e.button === 0) {
      playerRef.current?.pause();
      seekToClientX(e.clientX);
      const move = (ev: MouseEvent) => seekToClientX(ev.clientX);
      const up = () => {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    }
  };

  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    if (playheadX < sc.scrollLeft || playheadX > sc.scrollLeft + sc.clientWidth) {
      sc.scrollLeft = Math.max(0, playheadX - sc.clientWidth / 2);
    }
  }, [playheadX]);

  const previewSec = hoverMark ? hoverMark.expandedFrame / fps : null;

  return (
    <div className="timeline">
      <div
        className="timeline-scroll"
        ref={scrollRef}
        onMouseDown={onMouseDown}
        onContextMenu={(e) => e.preventDefault()}
        onDragOver={(e) => {
          if (!onAddSegment || dividerMarks.length === 0) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setHoverMark(nearestMark(secAtClientX(e.clientX)));
        }}
        onDragLeave={() => setHoverMark(null)}
        onDrop={(e) => {
          const id = e.dataTransfer.getData("text/template");
          if (!id || !onAddSegment || dividerMarks.length === 0) return;
          e.preventDefault();
          const m = nearestMark(secAtClientX(e.clientX));
          if (m) onAddSegment(id, m.originalFrame / fps); // insert at the original opening
          setHoverMark(null);
        }}
        title="Tap or drag to scrub · middle-drag to pan · drop a template into a section opening"
      >
        <div className="timeline-ruler" ref={rulerRef} style={{ width }}>
          {minors.map((t, i) => (
            <div key={`mn${i}`} className="timeline-minor" style={{ left: t * pxPerSec }} />
          ))}
          {majors.map((t, i) => (
            <div key={`mj${i}`} className="timeline-tick" style={{ left: t * pxPerSec }}>
              <span className="timeline-tick-label">{tc(t)}</span>
            </div>
          ))}

          {dividerMarks.map((m) => (
            <div
              key={`dv${m.originalFrame}`}
              className="timeline-divider"
              data-hover={hoverMark?.originalFrame === m.originalFrame}
              style={{ left: (m.expandedFrame / fps) * pxPerSec }}
            >
              <span className="timeline-slot" />
            </div>
          ))}

          {segments.map((s) => (
            <div
              key={s.id}
              className="timeline-seg"
              data-synced={s.synced}
              style={{
                left: s.expandedStartSec * pxPerSec,
                width: Math.max(12, s.durationSec * pxPerSec),
                background: hexToRgba(s.color, 0.22),
                borderColor: s.color,
              }}
              title={`${s.name} · ${s.durationSec}s · ${s.synced ? "synced" : "not synced (free placeholder)"}`}
            >
              <span className="timeline-seg-label">{s.name}</span>
              {onRemoveSegment && (
                <button
                  className="timeline-seg-del"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveSegment(s.id);
                  }}
                  title="Remove this section"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          ))}

          {previewSec != null && dragTemplate && (
            <div
              className="timeline-preview"
              style={{
                left: previewSec * pxPerSec,
                width: Math.max(12, dragTemplate.durationSec * pxPerSec),
                borderColor: dragTemplate.color,
                background: hexToRgba(dragTemplate.color, 0.18),
              }}
            >
              <span className="timeline-seg-label">{dragTemplate.name}</span>
            </div>
          )}

          <div className="timeline-playhead" style={{ left: playheadX }} />
        </div>
      </div>
    </div>
  );
};
