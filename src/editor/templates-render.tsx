import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { INFOGRAPHIC_TEMPLATE_COMPONENTS } from "./templates-infographic";

// Animated, frame-driven renders of each template — white/gray, sized to the comp.
// These are what actually play in the inserted section of the composed timeline.

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

export const WomenInTechTemplate: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const op = useFade();
  const s = Math.min(width, height);
  const cx = width / 2;
  const cy = height / 2;
  const rings = [0.18, 0.32, 0.46].map((r) => r * s);
  const rot = frame * 0.5; // slow orbit (deg)
  const dots = Array.from({ length: 8 }, (_, i) => {
    const a = ((rot + i * 45) * Math.PI) / 180;
    return { x: cx + Math.cos(a) * rings[2], y: cy + Math.sin(a) * rings[2] };
  });
  return (
    <AbsoluteFill style={{ background: "#ffffff", opacity: op }}>
      <svg width={width} height={height}>
        {rings.map((r, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke="#e3e3e7" strokeWidth={2} />
        ))}
        <circle cx={cx - s * 0.045} cy={cy - s * 0.025} r={s * 0.055} fill="#cdcdd2" />
        <circle cx={cx + s * 0.05} cy={cy - s * 0.008} r={s * 0.055} fill="#cdcdd2" />
        <circle cx={cx} cy={cy + s * 0.06} r={s * 0.045} fill="#cdcdd2" />
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={s * 0.03} fill="#cdcdd2" opacity={0.82} />
        ))}
      </svg>
    </AbsoluteFill>
  );
};

export const CardFadeTemplate: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const op = useFade();
  const cw = width * 0.18;
  const ch = height * 0.5;
  const top = height / 2 - ch / 2;
  const cards = [
    { x: width * 0.5 - cw / 2, delay: 0, sharp: true },
    { x: width * 0.5 - cw / 2 - cw * 1.35, delay: 8, sharp: false },
    { x: width * 0.5 - cw / 2 + cw * 1.35, delay: 16, sharp: false },
  ];
  return (
    <AbsoluteFill style={{ background: "#ffffff", opacity: op }}>
      {cards.map((c, i) => {
        const cop = interpolate(frame, [c.delay, c.delay + 12], [0, c.sharp ? 1 : 0.4], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const sc = interpolate(frame, [c.delay, c.delay + 12], [0.92, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: c.x,
              top,
              width: cw,
              height: ch,
              background: "#cdcdd2",
              borderRadius: 16,
              opacity: cop,
              transform: `scale(${sc})`,
              filter: c.sharp ? "none" : "blur(6px)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

export const TEMPLATE_COMPONENTS: Record<string, React.FC> = {
  "women-in-tech": WomenInTechTemplate,
  "card-fade": CardFadeTemplate,
  ...INFOGRAPHIC_TEMPLATE_COMPONENTS,
};
