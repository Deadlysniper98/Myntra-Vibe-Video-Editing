import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Template } from "./templates";
import { INFO_T, dotGridStyle } from "../styles/infographic/tokens";
import { BarRace, DonutPercent, StatCounter, TitleCard } from "../styles/infographic/blocks";

// "Signal Flat" infographic blocks exposed as drop-insertable timeline templates.
// Integration (no existing file is modified here):
//   - spread INFOGRAPHIC_TEMPLATES into TEMPLATES (src/editor/templates.ts)
//   - spread INFOGRAPHIC_TEMPLATE_COMPONENTS into TEMPLATE_COMPONENTS
//     (src/editor/templates-render.tsx)
//   - render <InfographicTemplateThumb id={id} /> from the TemplateThumb
//     fallback branch (src/editor/Library.tsx)

export const INFOGRAPHIC_TEMPLATES: Template[] = [
  { id: "info-title", name: "Info · Title Card", durationSec: 3, color: "#FF5C38" },
  { id: "info-stat", name: "Info · Stat Counter", durationSec: 4, color: "#FFC53D" },
  { id: "info-donut", name: "Info · Donut %", durationSec: 4, color: "#2D6BFF" },
  { id: "info-bars", name: "Info · Bar Chart", durationSec: 5, color: "#19B27B" },
];

// Same blend-in/out fade the existing templates use (templates-render.tsx).
const useFade = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const inn = interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const out = interpolate(frame, [durationInFrames - 14, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return inn * out;
};

// The blocks lay out on a 1280x720 stage; the shell centers + scales that stage
// so the same template works in 16:9 and 9:16 comps.
const InfoStage: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { width, height } = useVideoConfig();
  const op = useFade();
  const scale = Math.min(width / 1280, height / 720);
  return (
    <AbsoluteFill
      style={{
        background: INFO_T.color.bg,
        opacity: op,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AbsoluteFill style={dotGridStyle} />
      <div
        style={{
          width: 1280,
          height: 720,
          position: "relative",
          flex: "none",
          transform: `scale(${scale})`,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

const InfoTitleTemplate: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <InfoStage>
      <TitleCard frame={frame} kicker="Chapter One" title="A Bigger Picture" highlightWord="Bigger" />
    </InfoStage>
  );
};

const InfoStatTemplate: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <InfoStage>
      <StatCounter frame={frame} value={12500} suffix="+" label="hours saved with automated workflows" />
    </InfoStage>
  );
};

const InfoDonutTemplate: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <InfoStage>
      <DonutPercent
        frame={frame}
        percent={73}
        title="Nearly three quarters"
        text="of viewers finish videos that lead with a single clear number."
      />
    </InfoStage>
  );
};

const InfoBarsTemplate: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <InfoStage>
      <BarRace
        frame={frame}
        title="Where the growth is"
        bars={[
          { label: "Shorts", value: 84 },
          { label: "Live", value: 61 },
          { label: "Longform", value: 47 },
          { label: "Audio", value: 29 },
        ]}
      />
    </InfoStage>
  );
};

export const INFOGRAPHIC_TEMPLATE_COMPONENTS: Record<string, React.FC> = {
  "info-title": InfoTitleTemplate,
  "info-stat": InfoStatTemplate,
  "info-donut": InfoDonutTemplate,
  "info-bars": InfoBarsTemplate,
};

// Static 160x90 thumbnails for the Library drawer — same skeleton as the
// existing TemplateThumb branches (white card, gray shapes) with one Signal
// Flat accent element so the infographic set reads at a glance.
export const InfographicTemplateThumb: React.FC<{ id: string }> = ({ id }) => {
  if (id === "info-title") {
    return (
      <svg viewBox="0 0 160 90" className="lib-svg" preserveAspectRatio="xMidYMid meet">
        <rect width="160" height="90" fill="#ffffff" />
        <rect x="62" y="18" width="36" height="10" rx="5" fill="#FFC53D" opacity="0.85" />
        <rect x="30" y="38" width="100" height="12" rx="4" fill="#cdcdd2" />
        <rect x="44" y="56" width="72" height="12" rx="4" fill="#cdcdd2" />
        <rect x="66" y="76" width="28" height="3" rx="1.5" fill="#FF5C38" />
      </svg>
    );
  }
  if (id === "info-stat") {
    return (
      <svg viewBox="0 0 160 90" className="lib-svg" preserveAspectRatio="xMidYMid meet">
        <rect width="160" height="90" fill="#ffffff" />
        <g fill="#FF5C38">
          <rect x="44" y="22" width="14" height="34" rx="4" />
          <rect x="64" y="22" width="14" height="34" rx="4" />
          <rect x="84" y="22" width="14" height="34" rx="4" />
        </g>
        <rect x="104" y="36" width="12" height="20" rx="3" fill="#cdcdd2" />
        <rect x="48" y="66" width="64" height="8" rx="4" fill="#e3e3e7" />
      </svg>
    );
  }
  if (id === "info-donut") {
    return (
      <svg viewBox="0 0 160 90" className="lib-svg" preserveAspectRatio="xMidYMid meet">
        <rect width="160" height="90" fill="#ffffff" />
        <circle cx="58" cy="45" r="24" fill="none" stroke="#e3e3e7" strokeWidth="9" />
        <circle
          cx="58"
          cy="45"
          r="24"
          fill="none"
          stroke="#2D6BFF"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray="104 151"
          transform="rotate(-90 58 45)"
        />
        <rect x="96" y="32" width="40" height="8" rx="4" fill="#cdcdd2" />
        <rect x="96" y="46" width="30" height="8" rx="4" fill="#e3e3e7" />
      </svg>
    );
  }
  if (id === "info-bars") {
    return (
      <svg viewBox="0 0 160 90" className="lib-svg" preserveAspectRatio="xMidYMid meet">
        <rect width="160" height="90" fill="#ffffff" />
        <rect x="34" y="18" width="3" height="54" rx="1.5" fill="#cdcdd2" />
        <rect x="40" y="20" width="86" height="12" rx="6" fill="#19B27B" />
        <rect x="40" y="39" width="62" height="12" rx="6" fill="#cdcdd2" />
        <rect x="40" y="58" width="40" height="12" rx="6" fill="#e3e3e7" />
      </svg>
    );
  }
  return null;
};
