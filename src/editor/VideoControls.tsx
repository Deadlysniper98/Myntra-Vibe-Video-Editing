import React, { useEffect, useState } from "react";
import type { PlayerRef } from "@remotion/player";
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Ruler,
  X,
} from "lucide-react";
import { Timeline, ZOOM_LEVELS } from "./Timeline";
import type { TimelineSeg, DividerMark, Template } from "./templates";

interface VideoControlsProps {
  playerRef: React.RefObject<PlayerRef | null>;
  durationInFrames: number;
  fps: number;
  dividerMarks?: DividerMark[];
  segments?: TimelineSeg[];
  dragTemplate?: Template | null;
  onAddSegment?: (templateId: string, sec: number) => void;
  onRemoveSegment?: (id: string) => void;
}

const fmt = (frame: number, fps: number) => {
  const t = Math.max(0, frame) / fps;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

// Always-visible media controls. The detailed Timeline ruler IS the scrubber; the
// transport row sits below, with a zoom popup tucked into the bottom-right.
export const VideoControls: React.FC<VideoControlsProps> = ({
  playerRef,
  durationInFrames,
  fps,
  dividerMarks,
  segments,
  dragTemplate,
  onAddSegment,
  onRemoveSegment,
}) => {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1); // index into ZOOM_LEVELS → default 5s
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    const onFrame = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onVol = () => {
      setMuted(p.isMuted());
      setVolume(p.getVolume());
    };
    const onFs = () => setFullscreen(p.isFullscreen());
    p.addEventListener("frameupdate", onFrame as never);
    p.addEventListener("play", onPlay);
    p.addEventListener("pause", onPause);
    p.addEventListener("volumechange", onVol as never);
    p.addEventListener("fullscreenchange", onFs as never);
    setPlaying(p.isPlaying());
    setMuted(p.isMuted());
    setVolume(p.getVolume());
    setFullscreen(p.isFullscreen());
    return () => {
      p.removeEventListener("frameupdate", onFrame as never);
      p.removeEventListener("play", onPlay);
      p.removeEventListener("pause", onPause);
      p.removeEventListener("volumechange", onVol as never);
      p.removeEventListener("fullscreenchange", onFs as never);
    };
  }, [playerRef]);

  const cur = () => playerRef.current;
  const togglePlay = () => cur()?.toggle();
  const stepFrame = (d: number) => {
    const p = cur();
    if (!p) return;
    p.pause();
    p.seekTo(Math.max(0, Math.min(durationInFrames - 1, p.getCurrentFrame() + d)));
  };
  const toggleMute = () => {
    const p = cur();
    if (!p) return;
    if (p.isMuted()) p.unmute();
    else p.mute();
  };
  const onVolume = (v: number) => {
    const p = cur();
    if (!p) return;
    p.setVolume(v);
    if (v === 0) p.mute();
    else if (p.isMuted()) p.unmute();
  };
  const toggleFs = () => {
    const p = cur();
    if (!p) return;
    if (p.isFullscreen()) p.exitFullscreen();
    else p.requestFullscreen();
  };

  const isMuted = muted || volume === 0;
  const secPerMajor = ZOOM_LEVELS[zoom];

  return (
    <div className="video-controls">
      <Timeline
        playerRef={playerRef}
        durationInFrames={durationInFrames}
        fps={fps}
        zoom={zoom}
        dividerMarks={dividerMarks}
        segments={segments}
        dragTemplate={dragTemplate}
        onAddSegment={onAddSegment}
        onRemoveSegment={onRemoveSegment}
      />

      <div className="video-controls-transport">
        <div className="video-controls-playback">
          <button className="vc-btn" onClick={togglePlay} title={playing ? "Pause" : "Play"} type="button">
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-px" />}
          </button>
          <button className="vc-btn" onClick={() => stepFrame(-1)} title="Previous frame" type="button">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button className="vc-btn" onClick={() => stepFrame(1)} title="Next frame" type="button">
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="video-controls-time">
            {fmt(frame, fps)} / {fmt(durationInFrames, fps)}
          </span>
          <span className="video-controls-frames" title="current frame / total frames">
            f{frame}/{durationInFrames}
          </span>
        </div>

        <div className="video-controls-utils">
          <div className="volume-wrap">
            <button className="vc-btn" onClick={toggleMute} title={isMuted ? "Unmute" : "Mute"} type="button">
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => onVolume(Number(e.target.value))}
              className="ui-range vol-slider"
              style={{ ["--fill" as string]: `${(isMuted ? 0 : volume) * 100}%` } as React.CSSProperties}
              title="Volume"
              aria-label="Volume"
            />
          </div>

          <div className="zoom-wrap">
            <button
              className="vc-btn"
              data-active={zoomOpen ? "true" : undefined}
              onClick={() => setZoomOpen((o) => !o)}
              title={`Timeline divisions · ${secPerMajor}s`}
              type="button"
            >
              <Ruler className="h-4 w-4" />
            </button>
            {zoomOpen && (
              <>
                <div className="zoom-backdrop" onClick={() => setZoomOpen(false)} />
                <div className="zoom-popup">
                  <div className="zoom-popup-head">
                    <span>Divisions</span>
                    <button
                      className="zoom-popup-x"
                      onClick={() => setZoomOpen(false)}
                      aria-label="Close"
                      type="button"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="zoom-popup-label">{secPerMajor}s / division</div>
                  <input
                    type="range"
                    min={0}
                    max={ZOOM_LEVELS.length - 1}
                    step={1}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="ui-range w-full"
                    style={{ ["--fill" as string]: `${(zoom / (ZOOM_LEVELS.length - 1)) * 100}%` } as React.CSSProperties}
                  />
                  <div className="zoom-popup-marks">
                    {ZOOM_LEVELS.map((l) => (
                      <span key={l}>{l}s</span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            className="vc-btn vc-btn--fs"
            onClick={toggleFs}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            type="button"
          >
            {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
