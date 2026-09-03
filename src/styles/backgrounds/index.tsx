import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { INFO_T, dotGridStyle } from "../infographic/tokens";

// ─────────────────────────────────────────────────────────────────────────────
// Background engine — a registry of frame-driven animated backgrounds.
//
// EVERY component here renders inside Remotion compositions AND the
// @remotion/player, so ALL motion is derived from useCurrentFrame(). No CSS
// animations/transitions, no framer-motion, no Math.random()/Date.now() at
// render time — "random" values come from fixed seed tables below.
// Static CSS (perspective, gradients, blur) is fine; only MOTION is per-frame.
// ─────────────────────────────────────────────────────────────────────────────

export interface BackgroundStyleProps {
  colorA?: string;
  colorB?: string;
  bg?: string;
  /** Motion multiplier — 1 = default, 2+ = faster grid drift / glow pulse. */
  motion?: number;
}

export interface BackgroundChoice {
  id: string;
  colorA?: string;
  colorB?: string;
  bg?: string;
  motion?: number;
}

export interface BackgroundDef {
  id: string;
  name: string;
  /** Fills its parent absolutely (AbsoluteFill); animates from useCurrentFrame(). */
  component: React.FC<BackgroundStyleProps>;
  defaults: { colorA: string; colorB: string; bg: string };
  /**
   * 0..1 — recommended opacity of a cream "paper veil" layered over the
   * background so dark-ink infographic text stays readable.
   * Dark bgs ~0.85-0.9, light ~0.25-0.45, dot-grid 0.
   */
  veil: number;
  /** Small static preview (~160x90). Never animated. */
  thumb: React.FC;
}

// ── shared color helpers (pure + deterministic) ─────────────────────────────

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const hexToRgb = (hex: string): [number, number, number] | null => {
  if (!HEX_RE.test(hex)) return null;
  let h = hex.slice(1);
  if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Hex color at an alpha; falls back to the raw string for non-hex inputs. */
const rgba = (hex: string, a: number): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;
};

/** Hue (0..360) of a hex color; 0 for non-hex/achromatic input. */
const hexToHue = (hex: string): number => {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const r = rgb[0] / 255;
  const g = rgb[1] / 255;
  const b = rgb[2] / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};

// ─────────────────────────────────────────────────────────────────────────────
// 1) "dot-grid" — Clean Paper. Matches the current infographic look
//    (INFO_T + dotGridStyle), plus an extremely subtle frame-driven drift.
// ─────────────────────────────────────────────────────────────────────────────

const DOT_GRID_DEFAULTS = {
  colorA: INFO_T.color.ink,
  colorB: INFO_T.color.bgAlt,
  bg: INFO_T.color.bg,
};

const DotGridBackground: React.FC<BackgroundStyleProps> = ({ colorA, bg }) => {
  const frame = useCurrentFrame();
  const gap = INFO_T.dotGrid.gap;
  const dot = rgba(colorA ?? DOT_GRID_DEFAULTS.colorA, INFO_T.dotGrid.opacity);
  const r = INFO_T.dotGrid.size / 2;
  // Extremely subtle diagonal drift — loops naturally at the grid gap.
  const x = (frame * 0.02) % gap;
  const y = (frame * 0.03) % gap;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: bg ?? DOT_GRID_DEFAULTS.bg,
        ...dotGridStyle,
        backgroundImage: `radial-gradient(circle, ${dot} ${r}px, transparent ${r}px)`,
        backgroundPosition: `${x}px ${y}px`,
      }}
    />
  );
};

const DotGridThumb: React.FC = () => (
  <svg viewBox="0 0 160 90" className="lib-svg" preserveAspectRatio="xMidYMid meet">
    <rect width="160" height="90" fill="#F7F3EC" />
    <defs>
      <pattern id="bgx-dot-p" width="14" height="14" patternUnits="userSpaceOnUse">
        <circle cx="3" cy="3" r="1.1" fill="rgba(26,28,46,0.28)" />
      </pattern>
    </defs>
    <rect width="160" height="90" fill="url(#bgx-dot-p)" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// 2) "falling-lines" — port of the framer-motion "falling pattern": 36 stacked
//    radial-gradient layers (thin vertical streaks + dots) raining over a dark
//    bg, with a static dotted backdrop-filter overlay. The original animated
//    backgroundPosition keyframes are replaced by per-frame linear
//    interpolation between start/end positions, looping over ~4500 frames.
// ─────────────────────────────────────────────────────────────────────────────

const FALLING_DEFAULTS = { colorA: "#8B9BFF", colorB: "#5E6CFF", bg: "#070810" };

const FALL_ROW_HEIGHTS = [235, 252, 150, 253, 204, 134, 179, 299, 215, 281, 158, 210];

const FALL_START_STR =
  "0px 220px, 3px 220px, 151.5px 337.5px, 25px 24px, 28px 24px, 176.5px 150px, 50px 16px, 53px 16px, 201.5px 91px, 75px 224px, 78px 224px, 226.5px 230.5px, 100px 19px, 103px 19px, 251.5px 121px, 125px 120px, 128px 120px, 276.5px 187px, 150px 31px, 153px 31px, 301.5px 120.5px, 175px 235px, 178px 235px, 326.5px 384.5px, 200px 121px, 203px 121px, 351.5px 228.5px, 225px 224px, 228px 224px, 376.5px 364.5px, 250px 26px, 253px 26px, 401.5px 105px, 275px 75px, 278px 75px, 426.5px 180px";

const FALL_END_STR =
  "0px 6800px, 3px 6800px, 151.5px 6917.5px, 25px 13632px, 28px 13632px, 176.5px 13758px, 50px 5416px, 53px 5416px, 201.5px 5491px, 75px 17175px, 78px 17175px, 226.5px 17301.5px, 100px 5119px, 103px 5119px, 251.5px 5221px, 125px 8428px, 128px 8428px, 276.5px 8495px, 150px 9876px, 153px 9876px, 301.5px 9965.5px, 175px 13391px, 178px 13391px, 326.5px 13540.5px, 200px 14741px, 203px 14741px, 351.5px 14848.5px, 225px 18770px, 228px 18770px, 376.5px 18910.5px, 250px 5082px, 253px 5082px, 401.5px 5161px, 275px 6375px, 278px 6375px, 426.5px 6480px";

/** Parse "Xpx Ypx, ..." into number pairs ONCE at module scope. */
const parsePositionPairs = (s: string): Array<[number, number]> =>
  s.split(",").map((pair) => {
    const parts = pair.trim().split(/\s+/);
    return [parseFloat(parts[0]), parseFloat(parts[1])];
  });

const FALL_START = parsePositionPairs(FALL_START_STR);
const FALL_END = parsePositionPairs(FALL_END_STR);
const FALL_LOOP_FRAMES = 4500;

const buildFallingGradients = (color: string): string =>
  FALL_ROW_HEIGHTS.map((h) =>
    [
      `radial-gradient(4px 100px at 0px ${h}px, ${color}, transparent)`,
      `radial-gradient(4px 100px at 300px ${h}px, ${color}, transparent)`,
      `radial-gradient(1.5px 1.5px at 150px ${h / 2}px, ${color} 100%, transparent 150%)`,
    ].join(", "),
  ).join(", ");

const FALL_BG_SIZE = FALL_ROW_HEIGHTS.map((h) => {
  const s = `300px ${h}px`;
  return `${s}, ${s}, ${s}`;
}).join(", ");

const FallingLinesBackground: React.FC<BackgroundStyleProps> = ({ colorA, bg }) => {
  const frame = useCurrentFrame();
  const streak = colorA ?? FALLING_DEFAULTS.colorA;
  const base = bg ?? FALLING_DEFAULTS.bg;
  const backgroundImage = useMemo(() => buildFallingGradients(streak), [streak]);
  const t = (frame % FALL_LOOP_FRAMES) / FALL_LOOP_FRAMES;
  const backgroundPosition = FALL_START.map((p, i) => {
    const e = FALL_END[i];
    const x = p[0] + (e[0] - p[0]) * t;
    const y = p[1] + (e[1] - p[1]) * t;
    return `${Math.round(x * 100) / 100}px ${Math.round(y * 100) / 100}px`;
  }).join(", ");
  return (
    <AbsoluteFill style={{ backgroundColor: base, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage,
          backgroundSize: FALL_BG_SIZE,
          backgroundPosition,
        }}
      />
      {/* Static dotted-mask blur overlay (kept as-is from the original). */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backdropFilter: "blur(1em)",
          WebkitBackdropFilter: "blur(1em)",
          backgroundImage: `radial-gradient(circle at 50% 50%, transparent 0, transparent 2px, ${base} 2px)`,
          backgroundSize: "8px 8px",
        }}
      />
    </AbsoluteFill>
  );
};

const FallingLinesThumb: React.FC = () => (
  <svg viewBox="0 0 160 90" className="lib-svg" preserveAspectRatio="xMidYMid meet">
    <rect width="160" height="90" fill="#070810" />
    <defs>
      <linearGradient id="bgx-fall-g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#8B9BFF" stopOpacity="0" />
        <stop offset="0.55" stopColor="#8B9BFF" stopOpacity="0.9" />
        <stop offset="1" stopColor="#8B9BFF" stopOpacity="0" />
      </linearGradient>
    </defs>
    <g>
      <rect x="18" y="4" width="2" height="46" fill="url(#bgx-fall-g)" />
      <rect x="48" y="26" width="2" height="52" fill="url(#bgx-fall-g)" />
      <rect x="78" y="10" width="2" height="44" fill="url(#bgx-fall-g)" />
      <rect x="108" y="34" width="2" height="50" fill="url(#bgx-fall-g)" />
      <rect x="138" y="16" width="2" height="46" fill="url(#bgx-fall-g)" />
    </g>
    <g fill="#8B9BFF" opacity="0.8">
      <circle cx="33" cy="60" r="1.2" />
      <circle cx="63" cy="20" r="1.2" />
      <circle cx="93" cy="70" r="1.2" />
      <circle cx="123" cy="42" r="1.2" />
    </g>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// 3) "warp-grid" — port of the magicui "WarpBackground": a perspective box
//    with 4 grid planes and colored beams traveling along each plane. Beam
//    positions come from a FIXED seed table; only the beam Y is frame-driven.
// ─────────────────────────────────────────────────────────────────────────────

const WARP_DEFAULTS = { colorA: "#4A3B6B", colorB: "#6D7BFF", bg: "#0B0710" };

type WarpSide = "top" | "bottom" | "left" | "right";

interface WarpBeamSeed {
  side: WarpSide;
  /** left offset on its plane, % */
  x: number;
  /** hue offset added to colorB's hue */
  hue: number;
  /** beam aspect ratio (height = width * ar) */
  ar: number;
  /** phase offset in frames */
  phase: number;
  /** loop period in frames (~90) */
  period: number;
}

// Fixed seed table — 12 beams, 3 per side. Never randomized.
const WARP_BEAMS: WarpBeamSeed[] = [
  { side: "top", x: 0, hue: 0, ar: 3, phase: 0, period: 90 },
  { side: "top", x: 35, hue: 45, ar: 6, phase: 30, period: 110 },
  { side: "top", x: 70, hue: 90, ar: 4, phase: 60, period: 96 },
  { side: "bottom", x: 0, hue: 160, ar: 8, phase: 15, period: 104 },
  { side: "bottom", x: 35, hue: 200, ar: 5, phase: 45, period: 88 },
  { side: "bottom", x: 70, hue: 260, ar: 7, phase: 75, period: 118 },
  { side: "left", x: 0, hue: 300, ar: 4, phase: 10, period: 92 },
  { side: "left", x: 35, hue: 330, ar: 6, phase: 40, period: 108 },
  { side: "left", x: 70, hue: 20, ar: 3, phase: 70, period: 100 },
  { side: "right", x: 0, hue: 120, ar: 7, phase: 25, period: 86 },
  { side: "right", x: 35, hue: 180, ar: 5, phase: 55, period: 114 },
  { side: "right", x: 70, hue: 280, ar: 8, phase: 85, period: 98 },
];

const WARP_SIDES: WarpSide[] = ["top", "bottom", "left", "right"];

const warpPlaneStyle = (side: WarpSide, gridColor: string): React.CSSProperties => {
  const grid: React.CSSProperties = {
    position: "absolute",
    backgroundImage: `linear-gradient(${gridColor} 0 1px, transparent 1px 100%), linear-gradient(90deg, ${gridColor} 0 1px, transparent 1px 100%)`,
    backgroundSize: "5% 5%", // 5% cell size, exactly like the original
  };
  if (side === "top") {
    return { ...grid, top: 0, left: 0, width: "100%", height: "100cqmax", transformOrigin: "50% 0%", transform: "rotateX(-90deg)" };
  }
  if (side === "bottom") {
    return { ...grid, top: "100%", left: 0, width: "100%", height: "100cqmax", transformOrigin: "50% 0%", transform: "rotateX(-90deg)" };
  }
  if (side === "left") {
    return { ...grid, top: 0, left: 0, width: "100cqh", height: "100cqmax", transformOrigin: "0% 0%", transform: "rotate(90deg) rotateX(-90deg)" };
  }
  return { ...grid, top: 0, right: 0, width: "100cqh", height: "100cqmax", transformOrigin: "100% 0%", transform: "rotate(-90deg) rotateX(-90deg)" };
};

const WarpGridBackground: React.FC<BackgroundStyleProps> = ({ colorA, colorB, bg }) => {
  const frame = useCurrentFrame();
  const gridColor = colorA ?? WARP_DEFAULTS.colorA;
  const hueBase = hexToHue(colorB ?? WARP_DEFAULTS.colorB);
  return (
    <AbsoluteFill style={{ backgroundColor: bg ?? WARP_DEFAULTS.bg, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          containerType: "size",
          perspective: "100px",
          transformStyle: "preserve-3d",
        }}
      >
        {WARP_SIDES.map((side) => (
          <div key={side} style={warpPlaneStyle(side, gridColor)}>
            {WARP_BEAMS.filter((s) => s.side === side).map((seed, i) => {
              const t = ((frame + seed.phase) % seed.period) / seed.period;
              // travels from the far edge (100cqmax) up past the near edge
              const y = 100 - 160 * t;
              const hue = (hueBase + seed.hue) % 360;
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: `${seed.x}%`,
                    width: "5%",
                    aspectRatio: `1 / ${seed.ar}`,
                    background: `linear-gradient(hsl(${hue}, 80%, 60%), transparent)`,
                    transform: `translateY(${y}cqmax)`,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const WarpGridThumb: React.FC = () => (
  <svg viewBox="0 0 160 90" className="lib-svg" preserveAspectRatio="xMidYMid meet">
    <rect width="160" height="90" fill="#0B0710" />
    <g stroke="#4A3B6B" strokeWidth="1" fill="none" opacity="0.9">
      <rect x="55" y="31" width="50" height="28" />
      <line x1="0" y1="0" x2="55" y2="31" />
      <line x1="160" y1="0" x2="105" y2="31" />
      <line x1="0" y1="90" x2="55" y2="59" />
      <line x1="160" y1="90" x2="105" y2="59" />
      <line x1="27" y1="15" x2="27" y2="75" />
      <line x1="133" y1="15" x2="133" y2="75" />
      <line x1="27" y1="15" x2="133" y2="15" />
      <line x1="27" y1="75" x2="133" y2="75" />
    </g>
    <rect x="36" y="6" width="4" height="14" fill="#6D7BFF" opacity="0.9" />
    <rect x="118" y="68" width="4" height="14" fill="#B45CFF" opacity="0.9" />
    <rect x="8" y="40" width="12" height="4" fill="#5CC8FF" opacity="0.8" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// 4) "synth-grid" / "synth-grid-red" — dark bg, sharp square grid (major lines
//    every 128px, minor every 32px, plus-marks at major intersections), and a
//    breathing glow rising from the bottom. Grid drifts upward very slowly.
// ─────────────────────────────────────────────────────────────────────────────

const SYNTH_VIOLET_DEFAULTS = { colorA: "#6D7BFF", colorB: "#9B5CFF", bg: "#0D0B14" };
const SYNTH_RED_DEFAULTS = { colorA: "#FF2222", colorB: "#FF5533", bg: "#0A0505" };

const plusMarkUri = (color: string): string => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'><path d='M64 58v12M58 64h12' stroke='${color}' stroke-width='2'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};

const makeSynthGrid = (
  defaults: { colorA: string; colorB: string; bg: string },
): React.FC<BackgroundStyleProps> => {
  const SynthGrid: React.FC<BackgroundStyleProps> = ({ colorA, colorB, bg, motion = 1 }) => {
    const frame = useCurrentFrame();
    const a = colorA ?? defaults.colorA;
    const b = colorB ?? defaults.colorB;
    const major = rgba(a, 0.5);
    const minor = rgba(a, 0.13);
    const mark = rgba(a, 0.85);
    const m = Math.max(0.5, motion);
    const driftY = (frame * 0.08 * m) % 128;
    const driftX = (frame * 0.035 * m) % 128;
    const glow = Math.sin(frame * 0.02 * m) * 0.18 + 0.82;
    const plusLayer = useMemo(() => plusMarkUri(mark), [mark]);
    return (
      <AbsoluteFill style={{ backgroundColor: bg ?? defaults.bg, overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: [
              plusLayer,
              `linear-gradient(90deg, ${major} 0 1px, transparent 1px)`,
              `linear-gradient(${major} 0 1px, transparent 1px)`,
              `linear-gradient(90deg, ${minor} 0 1px, transparent 1px)`,
              `linear-gradient(${minor} 0 1px, transparent 1px)`,
            ].join(", "),
            backgroundSize: "128px 128px, 128px 128px, 128px 128px, 32px 32px, 32px 32px",
            backgroundPosition: [
              `${64 - driftX}px ${64 - driftY}px`,
              `${-driftX}px ${-driftY}px`,
              `${-driftX}px ${-driftY}px`,
              `${-driftX}px ${-driftY}px`,
              `${-driftX}px ${-driftY}px`,
            ].join(", "),
          }}
        />
        {/* Glow rising from the bottom of frame; intensity breathes slowly. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "58%",
            background: `linear-gradient(to top, ${rgba(b, 0.55)}, ${rgba(b, 0.2)} 42%, transparent)`,
            opacity: glow,
          }}
        />
      </AbsoluteFill>
    );
  };
  return SynthGrid;
};

const SynthGridViolet = makeSynthGrid(SYNTH_VIOLET_DEFAULTS);
const SynthGridRed = makeSynthGrid(SYNTH_RED_DEFAULTS);

const makeSynthThumb = (
  key: string,
  colors: { colorA: string; colorB: string; bg: string },
): React.FC => {
  const SynthThumb: React.FC = () => (
    <svg viewBox="0 0 160 90" className="lib-svg" preserveAspectRatio="xMidYMid meet">
      <rect width="160" height="90" fill={colors.bg} />
      <defs>
        <pattern id={`bgx-syn-${key}`} width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M0 0H32M0 0V32" stroke={colors.colorA} strokeOpacity="0.45" strokeWidth="1" fill="none" />
          <path d="M8 0V32M16 0V32M24 0V32M0 8H32M0 16H32M0 24H32" stroke={colors.colorA} strokeOpacity="0.12" strokeWidth="0.5" fill="none" />
        </pattern>
        <linearGradient id={`bgx-syn-g-${key}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={colors.colorB} stopOpacity="0.6" />
          <stop offset="1" stopColor={colors.colorB} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="160" height="90" fill={`url(#bgx-syn-${key})`} />
      <rect y="42" width="160" height="48" fill={`url(#bgx-syn-g-${key})`} />
      <path d="M64 29v6M61 32h6M128 61v6M125 64h6" stroke={colors.colorA} strokeWidth="1.4" />
    </svg>
  );
  return SynthThumb;
};

// ─────────────────────────────────────────────────────────────────────────────
// 5) "soft-wash" — minimal bright field: cream base + huge blurred mint /
//    yellow / pink blobs drifting very slowly. No shimmer, no glow pulse.
// ─────────────────────────────────────────────────────────────────────────────

const SOFT_WASH_DEFAULTS = { colorA: "#C8F0A0", colorB: "#FFF4C4", bg: "#F8F3ED" };

const SOFT_WASH_BLOBS = [
  { x: 6, y: 10, w: 54, h: 48, color: "#C8F0A0", opacity: 0.48, phase: 0.0, fx: 0.004, fy: 0.003 },
  { x: 58, y: 6, w: 48, h: 44, color: "#FFF4C4", opacity: 0.55, phase: 1.8, fx: 0.003, fy: 0.004 },
  { x: 24, y: 52, w: 56, h: 46, color: "#FFBCF9", opacity: 0.38, phase: 3.4, fx: 0.0035, fy: 0.0025 },
  { x: 64, y: 48, w: 42, h: 40, color: "#C8F0A0", opacity: 0.36, phase: 2.2, fx: 0.0028, fy: 0.0038 },
];

const SoftWashBackground: React.FC<BackgroundStyleProps> = ({ bg, motion = 1 }) => {
  const frame = useCurrentFrame();
  const base = bg ?? SOFT_WASH_DEFAULTS.bg;
  const m = Math.max(0.5, motion);
  const pinkAngle = 155 + Math.sin(frame * 0.007) * 14;
  const pinkX = Math.sin(frame * 0.009) * 6;
  const pinkY = Math.cos(frame * 0.007) * 5;
  const pinkPulse = 0.32 + Math.sin(frame * 0.012) * 0.06;

  // Sparse grid — upward parallax drift (tuned so motion reads on video, not imperceptible)
  const gapNear = 40;
  const gapFar = 64;
  const driftXNear = (frame * 0.14 * m) % gapNear;
  const driftYNear = -((frame * 0.52 * m) % gapNear);
  const driftXFar = (frame * 0.08 * m) % gapFar;
  const driftYFar = -((frame * 0.3 * m) % gapFar);
  const lineNear = "rgba(26, 26, 26, 0.11)";
  const lineFar = "rgba(26, 26, 26, 0.065)";
  const gridMask =
    "radial-gradient(ellipse 92% 82% at 50% 46%, #000 12%, rgba(0,0,0,0.7) 55%, transparent 88%)";

  return (
    <AbsoluteFill style={{ backgroundColor: base, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `linear-gradient(165deg, ${base} 0%, #F5EDE4 38%, #F0E8DF 100%)`,
        }}
      />
      {SOFT_WASH_BLOBS.map((blob, i) => {
        const dx = Math.sin(frame * blob.fx + blob.phase) * 3;
        const dy = Math.cos(frame * blob.fy + blob.phase) * 2.5;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${blob.x}%`,
              top: `${blob.y}%`,
              width: `${blob.w}%`,
              height: `${blob.h}%`,
              borderRadius: "50%",
              background: blob.color,
              opacity: blob.opacity * 0.88,
              filter: "blur(90px)",
              transform: `translate(${dx}%, ${dy}%)`,
            }}
          />
        );
      })}

      {/* Corner haze only — keeps center clear for grid */}
      <AbsoluteFill
        style={{
          background: `
            radial-gradient(ellipse 42% 38% at 0% 100%, ${base} 0%, transparent 72%),
            radial-gradient(ellipse 38% 34% at 100% 0%, ${base} 0%, transparent 70%)
          `,
          opacity: 0.65,
        }}
      />

      <AbsoluteFill
        style={{
          background: `linear-gradient(${pinkAngle}deg, rgba(255,188,249,${pinkPulse}) 0%, rgba(255,244,196,0.18) 42%, transparent 68%)`,
          transform: `translate(${pinkX}%, ${pinkY}%) scale(1.08)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `linear-gradient(${pinkAngle + 40}deg, transparent 20%, rgba(255,110,6,0.06) 55%, rgba(255,188,249,0.14) 100%)`,
          transform: `translate(${-pinkY * 0.6}%, ${pinkX * 0.5}%)`,
          opacity: 0.9,
        }}
      />

      {/* Grid on top — parallax rise for depth */}
      <AbsoluteFill
        style={{
          backgroundImage: `
            linear-gradient(${lineFar} 1px, transparent 1px),
            linear-gradient(90deg, ${lineFar} 1px, transparent 1px)
          `,
          backgroundSize: `${gapFar}px ${gapFar}px`,
          backgroundPosition: `${driftXFar}px ${driftYFar}px`,
          filter: "blur(0.4px)",
          opacity: 0.72,
          WebkitMaskImage: gridMask,
          maskImage: gridMask,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `
            linear-gradient(${lineNear} 1px, transparent 1px),
            linear-gradient(90deg, ${lineNear} 1px, transparent 1px)
          `,
          backgroundSize: `${gapNear}px ${gapNear}px`,
          backgroundPosition: `${driftXNear}px ${driftYNear}px`,
          opacity: 0.85,
          WebkitMaskImage: gridMask,
          maskImage: gridMask,
        }}
      />

      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(248,243,237,0.06) 0%, rgba(255,244,196,0.05) 48%, rgba(255,188,249,0.04) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

const SoftWashThumb: React.FC = () => (
  <svg viewBox="0 0 160 90" className="lib-svg" preserveAspectRatio="xMidYMid meet">
    <rect width="160" height="90" fill="#F8F3ED" />
    <defs>
      <filter id="bgx-sw-b" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="10" />
      </filter>
    </defs>
    <g filter="url(#bgx-sw-b)">
      <ellipse cx="42" cy="32" rx="40" ry="26" fill="#C8F0A0" opacity="0.55" />
      <ellipse cx="118" cy="28" rx="36" ry="24" fill="#FFF4C4" opacity="0.65" />
      <ellipse cx="88" cy="68" rx="38" ry="24" fill="#FFBCF9" opacity="0.35" />
    </g>
  </svg>
);

// 6) "aurora-blur" — soft editorial look: light blue-grey field, huge blurred
//    blobs drifting/scaling very slowly, plus a static hairline SVG overlay
//    (2 large circles + a 3x3 grid of 1px lines).
// ─────────────────────────────────────────────────────────────────────────────

const AURORA_DEFAULTS = { colorA: "#1E3A8A", colorB: "#5B8DEF", bg: "#AEB9C6" };

// Fixed seed table for the blobs — never randomized.
const AURORA_BLOBS = [
  { x: 8, y: 14, w: 52, h: 46, phase: 0.0, useA: true, opacity: 0.5, fx: 0.008, fy: 0.006 },
  { x: 52, y: 2, w: 46, h: 40, phase: 2.1, useA: false, opacity: 0.55, fx: 0.006, fy: 0.009 },
  { x: 28, y: 48, w: 58, h: 50, phase: 4.2, useA: false, opacity: 0.45, fx: 0.007, fy: 0.005 },
  { x: 62, y: 52, w: 44, h: 42, phase: 1.3, useA: true, opacity: 0.4, fx: 0.005, fy: 0.008 },
];

const AURORA_LINE = "rgba(26, 28, 46, 0.14)";

const AuroraBlurBackground: React.FC<BackgroundStyleProps> = ({ colorA, colorB, bg }) => {
  const frame = useCurrentFrame();
  const a = colorA ?? AURORA_DEFAULTS.colorA;
  const b = colorB ?? AURORA_DEFAULTS.colorB;
  return (
    <AbsoluteFill style={{ backgroundColor: bg ?? AURORA_DEFAULTS.bg, overflow: "hidden" }}>
      {AURORA_BLOBS.map((blob, i) => {
        const dx = Math.sin(frame * blob.fx + blob.phase) * 5;
        const dy = Math.cos(frame * blob.fy + blob.phase) * 4;
        const s = 1 + Math.sin(frame * 0.005 + blob.phase) * 0.08;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${blob.x}%`,
              top: `${blob.y}%`,
              width: `${blob.w}%`,
              height: `${blob.h}%`,
              borderRadius: "50%",
              background: blob.useA ? a : b,
              opacity: blob.opacity,
              filter: "blur(80px)",
              transform: `translate(${dx}%, ${dy}%) scale(${s})`,
            }}
          />
        );
      })}
      {/* Static hairline overlay — 2 large circles + 3-col/3-row grid. */}
      <svg
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <g stroke={AURORA_LINE} strokeWidth="1" fill="none">
          <line x1="533" y1="0" x2="533" y2="900" />
          <line x1="1066" y1="0" x2="1066" y2="900" />
          <line x1="0" y1="300" x2="1600" y2="300" />
          <line x1="0" y1="600" x2="1600" y2="600" />
          <circle cx="470" cy="430" r="330" />
          <circle cx="1140" cy="520" r="410" />
        </g>
      </svg>
    </AbsoluteFill>
  );
};

const AuroraBlurThumb: React.FC = () => (
  <svg viewBox="0 0 160 90" className="lib-svg" preserveAspectRatio="xMidYMid meet">
    <rect width="160" height="90" fill="#AEB9C6" />
    <defs>
      <filter id="bgx-aur-b" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="9" />
      </filter>
    </defs>
    <g filter="url(#bgx-aur-b)">
      <ellipse cx="45" cy="30" rx="38" ry="24" fill="#1E3A8A" opacity="0.55" />
      <ellipse cx="112" cy="26" rx="34" ry="22" fill="#5B8DEF" opacity="0.6" />
      <ellipse cx="82" cy="68" rx="44" ry="26" fill="#5B8DEF" opacity="0.5" />
    </g>
    <g stroke="rgba(26,28,46,0.22)" strokeWidth="0.6" fill="none">
      <line x1="53" y1="0" x2="53" y2="90" />
      <line x1="107" y1="0" x2="107" y2="90" />
      <line x1="0" y1="30" x2="160" y2="30" />
      <line x1="0" y1="60" x2="160" y2="60" />
      <circle cx="47" cy="43" r="33" />
      <circle cx="114" cy="52" r="41" />
    </g>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// 6) "laser-grid" — reference: red laser grid wallpaper. Uniform square grid of
//    glowing red lines over near-black, heavy dark vignette at the edges and a
//    soft red haze breathing in the center.
// ─────────────────────────────────────────────────────────────────────────────

const LASER_GRID_DEFAULTS = { colorA: "#FF1E1E", colorB: "#8A0E0E", bg: "#120303" };

const LaserGridBackground: React.FC<BackgroundStyleProps> = ({ colorA, colorB, bg }) => {
  const frame = useCurrentFrame();
  const line = colorA ?? LASER_GRID_DEFAULTS.colorA;
  const haze = colorB ?? LASER_GRID_DEFAULTS.colorB;
  const base = bg ?? LASER_GRID_DEFAULTS.bg;
  // The whole grid "breathes" very slowly — no positional motion, like a hum.
  const pulse = Math.sin(frame * 0.03) * 0.12 + 0.88;
  const cell = 96;
  return (
    <AbsoluteFill style={{ backgroundColor: base, overflow: "hidden" }}>
      {/* Center haze under the grid */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 75% 70% at 50% 52%, ${rgba(haze, 0.55)}, transparent 75%)`,
          opacity: pulse,
        }}
      />
      {/* Soft wide glow lines + crisp core lines */}
      <AbsoluteFill
        style={{
          backgroundImage: [
            `linear-gradient(90deg, ${rgba(line, 0.22)} 0 5px, transparent 5px)`,
            `linear-gradient(${rgba(line, 0.22)} 0 5px, transparent 5px)`,
            `linear-gradient(90deg, ${rgba(line, 0.95)} 0 2px, transparent 2px)`,
            `linear-gradient(${rgba(line, 0.95)} 0 2px, transparent 2px)`,
          ].join(", "),
          backgroundSize: `${cell}px ${cell}px`,
          backgroundPosition: "-2.5px -2.5px, -2.5px -2.5px, -1px -1px, -1px -1px",
          opacity: pulse,
        }}
      />
      {/* Heavy edge vignette so the grid fades into black at the borders */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 78% 82% at 50% 50%, transparent 45%, ${rgba("#000000", 0.92)} 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

const LaserGridThumb: React.FC = () => (
  <svg viewBox="0 0 160 90" className="lib-svg" preserveAspectRatio="xMidYMid meet">
    <rect width="160" height="90" fill="#120303" />
    <defs>
      <pattern id="bgx-laser-p" width="16" height="16" patternUnits="userSpaceOnUse">
        <path d="M0 0H16M0 0V16" stroke="#FF1E1E" strokeWidth="1" fill="none" />
      </pattern>
      <radialGradient id="bgx-laser-v" cx="0.5" cy="0.5" r="0.72">
        <stop offset="0.45" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.9" />
      </radialGradient>
      <radialGradient id="bgx-laser-h" cx="0.5" cy="0.55" r="0.6">
        <stop offset="0" stopColor="#8A0E0E" stopOpacity="0.6" />
        <stop offset="1" stopColor="#8A0E0E" stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect width="160" height="90" fill="url(#bgx-laser-h)" />
    <rect width="160" height="90" fill="url(#bgx-laser-p)" />
    <rect width="160" height="90" fill="url(#bgx-laser-v)" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// 7) "ember-grid" — reference: black wallpaper with thin white hairline grid
//    and a red glow rising from the bottom. The glow breathes; the grid holds.
// ─────────────────────────────────────────────────────────────────────────────

const EMBER_GRID_DEFAULTS = { colorA: "#E8E8E8", colorB: "#E01010", bg: "#050505" };

const EmberGridBackground: React.FC<BackgroundStyleProps> = ({ colorA, colorB, bg }) => {
  const frame = useCurrentFrame();
  const line = rgba(colorA ?? EMBER_GRID_DEFAULTS.colorA, 0.28);
  const ember = colorB ?? EMBER_GRID_DEFAULTS.colorB;
  const base = bg ?? EMBER_GRID_DEFAULTS.bg;
  // Ember glow breathes slowly and creeps up/down a little, like embers.
  const breathe = Math.sin(frame * 0.018) * 0.12 + 0.88;
  const rise = Math.sin(frame * 0.01) * 4; // ±4% height sway
  return (
    <AbsoluteFill style={{ backgroundColor: base, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: `${54 + rise}%`,
          background: `linear-gradient(to top, ${rgba(ember, 0.85)}, ${rgba(ember, 0.35)} 45%, transparent)`,
          opacity: breathe,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(90deg, ${line} 0 1px, transparent 1px), linear-gradient(${line} 0 1px, transparent 1px)`,
          backgroundSize: "72px 72px",
        }}
      />
    </AbsoluteFill>
  );
};

const EmberGridThumb: React.FC = () => (
  <svg viewBox="0 0 160 90" className="lib-svg" preserveAspectRatio="xMidYMid meet">
    <rect width="160" height="90" fill="#050505" />
    <defs>
      <linearGradient id="bgx-ember-g" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor="#E01010" stopOpacity="0.85" />
        <stop offset="0.6" stopColor="#E01010" stopOpacity="0.25" />
        <stop offset="1" stopColor="#E01010" stopOpacity="0" />
      </linearGradient>
      <pattern id="bgx-ember-p" width="18" height="18" patternUnits="userSpaceOnUse">
        <path d="M0 0H18M0 0V18" stroke="#E8E8E8" strokeOpacity="0.3" strokeWidth="0.7" fill="none" />
      </pattern>
    </defs>
    <rect y="40" width="160" height="50" fill="url(#bgx-ember-g)" />
    <rect width="160" height="90" fill="url(#bgx-ember-p)" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// 8) "grain-asterisk" — reference: deep green grainy field with huge blurred
//    lime asterisk glyphs. Asterisks drift + rotate very slowly; a static SVG
//    turbulence layer supplies the film grain.
// ─────────────────────────────────────────────────────────────────────────────

const GRAIN_AST_DEFAULTS = { colorA: "#B7E389", colorB: "#0E3B24", bg: "#123726" };

const GRAIN_URI = (() => {
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'>" +
    "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/>" +
    "<feColorMatrix type='saturate' values='0'/></filter>" +
    "<rect width='220' height='220' filter='url(#n)' opacity='0.55'/></svg>";
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
})();

/** Six-spoke asterisk built from 3 rotated rounded bars (blur applied by parent). */
const AsteriskGlyph: React.FC<{ color: string }> = ({ color }) => (
  <>
    {[0, 60, 120].map((deg) => (
      <div
        key={deg}
        style={{
          position: "absolute",
          left: "42%",
          top: 0,
          width: "16%",
          height: "100%",
          borderRadius: 999,
          background: color,
          transform: `rotate(${deg}deg)`,
          transformOrigin: "50% 50%",
        }}
      />
    ))}
  </>
);

// Fixed placement seeds — two big glyphs like the reference, one tiny accent.
const AST_SEEDS = [
  { x: 34, y: -16, size: 46, rot: 8, phase: 0.4, opacity: 0.9 },
  { x: 58, y: 72, size: 38, rot: -14, phase: 2.6, opacity: 0.85 },
  { x: -12, y: 52, size: 30, rot: 22, phase: 4.4, opacity: 0.5 },
];

const GrainAsteriskBackground: React.FC<BackgroundStyleProps> = ({ colorA, colorB, bg }) => {
  const frame = useCurrentFrame();
  const glyph = colorA ?? GRAIN_AST_DEFAULTS.colorA;
  const shade = colorB ?? GRAIN_AST_DEFAULTS.colorB;
  const base = bg ?? GRAIN_AST_DEFAULTS.bg;
  return (
    <AbsoluteFill style={{ backgroundColor: base, overflow: "hidden" }}>
      {/* Dark cloth-like shading blobs */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 60% 50% at 30% 55%, ${rgba(shade, 0.9)}, transparent 70%), radial-gradient(ellipse 50% 45% at 85% 30%, ${rgba(shade, 0.7)}, transparent 70%)`,
        }}
      />
      {AST_SEEDS.map((s, i) => {
        const drift = Math.sin(frame * 0.008 + s.phase) * 2.5;
        const spin = s.rot + Math.sin(frame * 0.006 + s.phase) * 5;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${s.x}%`,
              top: `${s.y + drift}%`,
              width: `${s.size}%`,
              aspectRatio: "1 / 1",
              transform: `rotate(${spin}deg)`,
              filter: "blur(26px)",
              opacity: s.opacity,
            }}
          >
            <AsteriskGlyph color={glyph} />
          </div>
        );
      })}
      {/* Static film grain on top */}
      <AbsoluteFill style={{ backgroundImage: GRAIN_URI, backgroundSize: "220px 220px", opacity: 0.16, mixBlendMode: "overlay" }} />
    </AbsoluteFill>
  );
};

const GrainAsteriskThumb: React.FC = () => (
  <svg viewBox="0 0 160 90" className="lib-svg" preserveAspectRatio="xMidYMid meet">
    <rect width="160" height="90" fill="#123726" />
    <defs>
      <filter id="bgx-ast-b" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="4" />
      </filter>
    </defs>
    <radialGradient id="bgx-ast-s" cx="0.3" cy="0.6" r="0.6">
      <stop offset="0" stopColor="#0E3B24" stopOpacity="0.9" />
      <stop offset="1" stopColor="#0E3B24" stopOpacity="0" />
    </radialGradient>
    <rect width="160" height="90" fill="url(#bgx-ast-s)" />
    <g filter="url(#bgx-ast-b)" fill="none" stroke="#B7E389" strokeWidth="9" strokeLinecap="round">
      <g transform="translate(96,18)">
        <line x1="0" y1="-16" x2="0" y2="16" />
        <line x1="-14" y1="-8" x2="14" y2="8" />
        <line x1="-14" y1="8" x2="14" y2="-8" />
      </g>
      <g transform="translate(38,76)">
        <line x1="0" y1="-13" x2="0" y2="13" />
        <line x1="-11" y1="-6.5" x2="11" y2="6.5" />
        <line x1="-11" y1="6.5" x2="11" y2="-6.5" />
      </g>
    </g>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// 9) "starfield" — dark navy sky with 3 parallax layers of drifting stars.
//    Star positions come from a deterministic hash of the index (no Math.random).
// ─────────────────────────────────────────────────────────────────────────────

const STARFIELD_DEFAULTS = { colorA: "#DDE6FF", colorB: "#5B8DEF", bg: "#070B1A" };

interface StarSeed {
  x: number;
  y: number;
  r: number;
  layer: number; // 0 slow/far … 2 fast/near
  twinklePhase: number;
}

// 48 deterministic stars — integer hash spread, computed once at module scope.
const STARS: StarSeed[] = Array.from({ length: 48 }, (_, i) => ({
  x: ((i * 73 + 13) % 97) / 97 * 100,
  y: ((i * 41 + 29) % 89) / 89 * 100,
  r: 0.8 + ((i * 17) % 5) * 0.45,
  layer: i % 3,
  twinklePhase: (i * 37) % 60,
}));

const STAR_LAYER_SPEED = [0.006, 0.012, 0.022]; // %/frame drift per layer

const StarfieldBackground: React.FC<BackgroundStyleProps> = ({ colorA, colorB, bg }) => {
  const frame = useCurrentFrame();
  const star = colorA ?? STARFIELD_DEFAULTS.colorA;
  const nebula = colorB ?? STARFIELD_DEFAULTS.colorB;
  return (
    <AbsoluteFill style={{ backgroundColor: bg ?? STARFIELD_DEFAULTS.bg, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 55% at 70% 25%, ${rgba(nebula, 0.18)}, transparent 70%), radial-gradient(ellipse 55% 45% at 20% 80%, ${rgba(nebula, 0.12)}, transparent 70%)`,
        }}
      />
      {STARS.map((s, i) => {
        const x = (s.x + frame * STAR_LAYER_SPEED[s.layer]) % 104 - 2;
        const tw = Math.sin((frame + s.twinklePhase) * 0.05) * 0.3 + 0.7;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${s.y}%`,
              width: s.r * 2,
              height: s.r * 2,
              borderRadius: "50%",
              background: star,
              opacity: tw * (0.45 + s.layer * 0.25),
              boxShadow: s.layer === 2 ? `0 0 ${s.r * 4}px ${rgba(star, 0.6)}` : undefined,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const StarfieldThumb: React.FC = () => (
  <svg viewBox="0 0 160 90" className="lib-svg" preserveAspectRatio="xMidYMid meet">
    <rect width="160" height="90" fill="#070B1A" />
    <radialGradient id="bgx-star-n" cx="0.7" cy="0.25" r="0.6">
      <stop offset="0" stopColor="#5B8DEF" stopOpacity="0.25" />
      <stop offset="1" stopColor="#5B8DEF" stopOpacity="0" />
    </radialGradient>
    <rect width="160" height="90" fill="url(#bgx-star-n)" />
    <g fill="#DDE6FF">
      <circle cx="22" cy="18" r="1.4" />
      <circle cx="58" cy="42" r="1" />
      <circle cx="94" cy="12" r="1.7" opacity="0.9" />
      <circle cx="128" cy="34" r="1.1" />
      <circle cx="38" cy="66" r="1.5" />
      <circle cx="76" cy="78" r="1" opacity="0.7" />
      <circle cx="112" cy="60" r="1.8" />
      <circle cx="146" cy="76" r="1.2" opacity="0.8" />
      <circle cx="10" cy="44" r="0.9" opacity="0.6" />
      <circle cx="140" cy="10" r="0.9" opacity="0.6" />
    </g>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// 10) "mesh-pastel" — light editorial mesh-gradient: soft pastel blobs drifting
//     over warm cream. Light theme — ink text stays readable with a tiny veil.
// ─────────────────────────────────────────────────────────────────────────────

const MESH_DEFAULTS = { colorA: "#FFB4A2", colorB: "#B8C0FF", bg: "#FBF6EE" };

const MESH_BLOBS = [
  { x: 4, y: 6, w: 48, h: 44, useA: true, opacity: 0.5, phase: 0.0, fx: 0.007, fy: 0.005 },
  { x: 56, y: 0, w: 44, h: 40, useA: false, opacity: 0.45, phase: 1.9, fx: 0.005, fy: 0.008 },
  { x: 14, y: 52, w: 42, h: 40, useA: false, opacity: 0.4, phase: 3.7, fx: 0.008, fy: 0.006 },
  { x: 60, y: 54, w: 46, h: 42, useA: true, opacity: 0.42, phase: 5.1, fx: 0.006, fy: 0.007 },
];

const MeshPastelBackground: React.FC<BackgroundStyleProps> = ({ colorA, colorB, bg }) => {
  const frame = useCurrentFrame();
  const a = colorA ?? MESH_DEFAULTS.colorA;
  const b = colorB ?? MESH_DEFAULTS.colorB;
  return (
    <AbsoluteFill style={{ backgroundColor: bg ?? MESH_DEFAULTS.bg, overflow: "hidden" }}>
      {MESH_BLOBS.map((blob, i) => {
        const dx = Math.sin(frame * blob.fx + blob.phase) * 6;
        const dy = Math.cos(frame * blob.fy + blob.phase) * 5;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${blob.x}%`,
              top: `${blob.y}%`,
              width: `${blob.w}%`,
              height: `${blob.h}%`,
              borderRadius: "50%",
              background: blob.useA ? a : b,
              opacity: blob.opacity,
              filter: "blur(70px)",
              transform: `translate(${dx}%, ${dy}%)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const MeshPastelThumb: React.FC = () => (
  <svg viewBox="0 0 160 90" className="lib-svg" preserveAspectRatio="xMidYMid meet">
    <rect width="160" height="90" fill="#FBF6EE" />
    <defs>
      <filter id="bgx-mesh-b" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="10" />
      </filter>
    </defs>
    <g filter="url(#bgx-mesh-b)">
      <ellipse cx="40" cy="26" rx="36" ry="24" fill="#FFB4A2" opacity="0.6" />
      <ellipse cx="120" cy="20" rx="34" ry="22" fill="#B8C0FF" opacity="0.55" />
      <ellipse cx="52" cy="70" rx="34" ry="22" fill="#B8C0FF" opacity="0.5" />
      <ellipse cx="124" cy="72" rx="36" ry="24" fill="#FFB4A2" opacity="0.5" />
    </g>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// 11) "neon-diagonals" — dark bg with two counter-drifting layers of diagonal
//     neon stripes. Pure backgroundPosition motion; loops cleanly.
// ─────────────────────────────────────────────────────────────────────────────

const NEON_DIAG_DEFAULTS = { colorA: "#25F4EE", colorB: "#FE2C55", bg: "#0B0B12" };

const NEON_TILE = 240; // stripe repeat length along the drift axis

const NeonDiagonalsBackground: React.FC<BackgroundStyleProps> = ({ colorA, colorB, bg }) => {
  const frame = useCurrentFrame();
  const a = colorA ?? NEON_DIAG_DEFAULTS.colorA;
  const b = colorB ?? NEON_DIAG_DEFAULTS.colorB;
  const d1 = (frame * 0.6) % NEON_TILE;
  const d2 = (frame * 0.35) % NEON_TILE;
  return (
    <AbsoluteFill style={{ backgroundColor: bg ?? NEON_DIAG_DEFAULTS.bg, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          backgroundImage: `repeating-linear-gradient(115deg, transparent 0 92px, ${rgba(a, 0.5)} 92px 98px, transparent 98px ${NEON_TILE}px)`,
          backgroundPosition: `${d1}px 0px`,
          filter: "blur(1px)",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `repeating-linear-gradient(65deg, transparent 0 118px, ${rgba(b, 0.4)} 118px 123px, transparent 123px ${NEON_TILE}px)`,
          backgroundPosition: `${-d2}px 0px`,
          filter: "blur(1.5px)",
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 80% 80% at 50% 50%, transparent 55%, ${rgba("#000000", 0.7)} 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

const NeonDiagonalsThumb: React.FC = () => (
  <svg viewBox="0 0 160 90" className="lib-svg" preserveAspectRatio="xMidYMid meet">
    <rect width="160" height="90" fill="#0B0B12" />
    <g strokeWidth="4" opacity="0.8">
      <line x1="10" y1="100" x2="70" y2="-10" stroke="#25F4EE" />
      <line x1="60" y1="100" x2="120" y2="-10" stroke="#25F4EE" />
      <line x1="110" y1="100" x2="170" y2="-10" stroke="#25F4EE" />
    </g>
    <g strokeWidth="3" opacity="0.6">
      <line x1="-10" y1="-10" x2="60" y2="100" stroke="#FE2C55" />
      <line x1="50" y1="-10" x2="120" y2="100" stroke="#FE2C55" />
      <line x1="110" y1="-10" x2="180" y2="100" stroke="#FE2C55" />
    </g>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

export const BACKGROUNDS: BackgroundDef[] = [
  {
    id: "dot-grid",
    name: "Clean Paper",
    component: DotGridBackground,
    defaults: DOT_GRID_DEFAULTS,
    veil: 0,
    thumb: DotGridThumb,
  },
  {
    id: "falling-lines",
    name: "Falling Lines",
    component: FallingLinesBackground,
    defaults: FALLING_DEFAULTS,
    veil: 0.85,
    thumb: FallingLinesThumb,
  },
  {
    id: "warp-grid",
    name: "Warp Grid",
    component: WarpGridBackground,
    defaults: WARP_DEFAULTS,
    veil: 0.88,
    thumb: WarpGridThumb,
  },
  {
    id: "synth-grid",
    name: "Synth Grid · Violet",
    component: SynthGridViolet,
    defaults: SYNTH_VIOLET_DEFAULTS,
    veil: 0.9,
    thumb: makeSynthThumb("v", SYNTH_VIOLET_DEFAULTS),
  },
  {
    id: "synth-grid-red",
    name: "Synth Grid · Red",
    component: SynthGridRed,
    defaults: SYNTH_RED_DEFAULTS,
    veil: 0.9,
    thumb: makeSynthThumb("r", SYNTH_RED_DEFAULTS),
  },
  {
    id: "soft-wash",
    name: "Soft Wash · Cream",
    component: SoftWashBackground,
    defaults: SOFT_WASH_DEFAULTS,
    veil: 0.15,
    thumb: SoftWashThumb,
  },
  {
    id: "aurora-blur",
    name: "Aurora Blur",
    component: AuroraBlurBackground,
    defaults: AURORA_DEFAULTS,
    veil: 0.3,
    thumb: AuroraBlurThumb,
  },
  {
    id: "laser-grid",
    name: "Laser Grid · Red",
    component: LaserGridBackground,
    defaults: LASER_GRID_DEFAULTS,
    veil: 0.88,
    thumb: LaserGridThumb,
  },
  {
    id: "ember-grid",
    name: "Ember Grid",
    component: EmberGridBackground,
    defaults: EMBER_GRID_DEFAULTS,
    veil: 0.88,
    thumb: EmberGridThumb,
  },
  {
    id: "grain-asterisk",
    name: "Grain Asterisk",
    component: GrainAsteriskBackground,
    defaults: GRAIN_AST_DEFAULTS,
    veil: 0.85,
    thumb: GrainAsteriskThumb,
  },
  {
    id: "starfield",
    name: "Starfield",
    component: StarfieldBackground,
    defaults: STARFIELD_DEFAULTS,
    veil: 0.88,
    thumb: StarfieldThumb,
  },
  {
    id: "mesh-pastel",
    name: "Mesh Pastel",
    component: MeshPastelBackground,
    defaults: MESH_DEFAULTS,
    veil: 0.2,
    thumb: MeshPastelThumb,
  },
  {
    id: "neon-diagonals",
    name: "Neon Diagonals",
    component: NeonDiagonalsBackground,
    defaults: NEON_DIAG_DEFAULTS,
    veil: 0.88,
    thumb: NeonDiagonalsThumb,
  },
];

export const DEFAULT_BACKGROUND_ID = "dot-grid";

export function getBackgroundDef(id: string): BackgroundDef {
  const found = BACKGROUNDS.find((b) => b.id === id);
  if (found) return found;
  const fallback = BACKGROUNDS.find((b) => b.id === DEFAULT_BACKGROUND_ID);
  return fallback ?? BACKGROUNDS[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Smart engine default — deterministic keyword heuristic (no randomness).
// ─────────────────────────────────────────────────────────────────────────────

const KEYWORD_RULES: Array<{ id: string; words: string[] }> = [
  {
    // bright / creator / minimal topics
    id: "soft-wash",
    words: [
      "youtube", "creator", "claude", "video", "upload", "script", "minimal",
      "bright", "clean", "editorial", "playbook", "how to",
    ],
  },
  {
    // nature / organic / soft topics
    id: "aurora-blur",
    words: [
      "butterfly", "nature", "health", "garden", "life", "ocean", "flower",
      "plant", "organic", "calm", "wellness", "meditat", "earth", "forest",
      "gentle", "bio", "climate", "water", "sky", "bird", "animal",
    ],
  },
  {
    // tech / data / ai / startup
    id: "synth-grid",
    words: [
      "tech", "data", "artificial intelligence", "startup", "software",
      "code", "coding", "cyber", "digital", "crypto", "robot", "machine",
      "neural", "saas", "cloud", "server", "algorithm", "developer",
    ],
  },
  {
    // urgent / gaming / sports / energy
    id: "synth-grid-red",
    words: [
      "urgent", "gaming", "game", "sport", "energy", "fast", "speed",
      "race", "racing", "workout", "fitness", "battle", "versus", "alert",
      "extreme", "adrenaline", "esport",
    ],
  },
  {
    // process / flow / steps / journey
    id: "falling-lines",
    words: [
      "process", "flow", "step", "journey", "pipeline", "workflow",
      "how to", "guide", "timeline", "stage", "roadmap", "funnel", "recipe",
    ],
  },
  {
    // night / dreams / astronomy
    id: "starfield",
    words: [
      "night", "star", "dream", "sleep", "astronomy", "constellation",
      "midnight", "moon", "dark sky",
    ],
  },
  {
    // music / party / social / trends
    id: "neon-diagonals",
    words: [
      "music", "party", "dance", "trend", "viral", "social media", "tiktok",
      "concert", "festival", "nightlife", "dj",
    ],
  },
  {
    // space / 3d / future
    id: "warp-grid",
    words: [
      "space", "3d", "future", "futuristic", "galaxy", "universe", "sci-fi",
      "dimension", "warp", "cosmos", "quantum", "vr", "metaverse", "rocket",
      "planet", "orbit", "astro",
    ],
  },
];

/** Matches a keyword at a word start ("step" hits "steps", not "instep"). */
const hasKeyword = (text: string, kw: string): boolean => {
  let from = 0;
  for (;;) {
    const idx = text.indexOf(kw, from);
    if (idx < 0) return false;
    const before = idx === 0 ? "" : text.charAt(idx - 1);
    if (before === "" || !/[a-z0-9]/.test(before)) return true;
    from = idx + 1;
  }
};

/**
 * Deterministic heuristic — the "smart engine default". Standalone keyword
 * "ai" is handled separately (word-boundary on both sides) to avoid matching
 * inside words like "air" or "training".
 */
export function pickBackgroundForText(text: string): BackgroundChoice {
  const t = (text || "").toLowerCase();
  let id = DEFAULT_BACKGROUND_ID;
  let matched = false;
  for (const rule of KEYWORD_RULES) {
    for (const kw of rule.words) {
      if (hasKeyword(t, kw)) {
        id = rule.id;
        matched = true;
        break;
      }
    }
    if (matched) break;
  }
  if (!matched && /(^|[^a-z0-9])ai([^a-z0-9]|$)/.test(t)) {
    id = "synth-grid";
  }
  const def = getBackgroundDef(id);
  return { id: def.id, ...def.defaults };
}
