import React from "react";
import { RectangleHorizontal, RectangleVertical, Monitor, Square } from "lucide-react";

const ASPECT_ICON: Record<string, React.ReactNode> = {
  "16:9": <RectangleHorizontal className="h-3.5 w-3.5" />,
  "21:9": <Monitor className="h-3.5 w-3.5" />,
  "9:16": <RectangleVertical className="h-3.5 w-3.5" />,
  "1:1": <Square className="h-3.5 w-3.5" />,
};

interface VideoToolbarProps {
  aspect: string;
  label: string;
  aspectOptions: { aspect: string; compId: string }[];
  onPickAspect: (compId: string) => void;
}

export const VideoToolbar: React.FC<VideoToolbarProps> = ({
  aspect,
  label,
  aspectOptions,
  onPickAspect,
}) => {
  const hasChoice = aspectOptions.length > 1;
  return (
    <div className="video-toolbar">
      <h2 className="video-toolbar-title" title={label}>
        {label}
      </h2>
      <div className="video-toolbar-row">
        <span className="video-toolbar-label">Format</span>
        {hasChoice ? (
          <div className="video-toolbar-aspects">
            {aspectOptions.map((a) => (
              <button
                key={a.compId}
                type="button"
                onClick={() => onPickAspect(a.compId)}
                className="video-toolbar-aspect"
                data-active={aspect === a.aspect ? "true" : undefined}
                title={`${a.aspect} format`}
              >
                {ASPECT_ICON[a.aspect]}
                <span>{a.aspect}</span>
              </button>
            ))}
          </div>
        ) : (
          <span className="video-toolbar-aspect video-toolbar-aspect--static">
            {ASPECT_ICON[aspect]}
            <span>{aspect}</span>
          </span>
        )}
      </div>
    </div>
  );
};
