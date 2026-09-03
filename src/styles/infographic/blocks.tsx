import React from "react";
import { Easing, Img, interpolate, spring } from "remotion";
import { INFO_T, infoCardStyle, inkAlpha } from "./tokens";

// "Signal Flat" — reusable frame-driven infographic blocks.
// Every block is a PURE component taking the already-localized frame (the parent
// passes frame - startFrame), so blocks are freely sequencable via <Sequence> or
// manual offsets. Layout targets a 1280x720 stage (spec sizes ÷ 1.5 from the
// 1920x1080 reference) but uses %/flex wherever possible.
//
// Motion contract (30fps): entrances Easing.out(cubic), exits Easing.in(cubic),
// moves Easing.inOut(cubic); springs damping 200 (no bounce) except IconList
// chips and the CTA button; siblings always staggered; transform+opacity only.

const FPS = 30;

export const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const EASE_OUT = Easing.out(Easing.cubic);
export const EASE_IN = Easing.in(Easing.cubic);
export const EASE_INOUT = Easing.inOut(Easing.cubic);

const settle = (frame: number, delay = 0) =>
  spring({ frame: Math.max(0, frame - delay), fps: FPS, config: { damping: 200, mass: 0.8 } });

const pop = (frame: number, delay = 0, damping = 12) =>
  spring({ frame: Math.max(0, frame - delay), fps: FPS, config: { damping, mass: 0.8 } });

// Exit progress 0→1 over the last `len` frames; 0 when no duration is provided
// (parents that manage their own scene transition simply omit durationInFrames).
const exitP = (frame: number, durationInFrames: number | undefined, len: number) =>
  durationInFrames == null
    ? 0
    : interpolate(frame, [durationInFrames - len, durationInFrames - 2], [0, 1], {
        ...CLAMP,
        easing: EASE_IN,
      });

const fillCol: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
};

export interface BlockProps {
  frame: number; // already-localized frame (parent passes frame - startFrame)
  durationInFrames?: number; // when set, the block runs its own exit
  accent?: string;
}

/* ------------------------------------------------------------------ */
/* 2.1 Title Card                                                      */
/* ------------------------------------------------------------------ */

export type TitlePartTone = "hero" | "accent" | "muted" | "script";

export interface TitlePart {
  text: string;
  tone?: TitlePartTone;
  /** Small mark beside the word (staticFile path under public/) */
  iconSrc?: string;
}

export interface TitleCardProps extends BlockProps {
  kicker: string;
  title: string;
  highlightWord?: string; // gets the amber highlighter sweep at f45
  subtitle?: string;
  /** Per-line mixed typography — hero / muted / script emphasis */
  titleLines?: TitlePart[][];
  /** Tool names shown as a pipeline row on cinematic hero (e.g. Claude, Gemini). */
  stackLayers?: string[];
}

export const TitleCard: React.FC<TitleCardProps> = ({
  frame,
  durationInFrames,
  accent = INFO_T.color.accent,
  kicker,
  title,
  highlightWord,
}) => {
  const words = title.split(" ");
  const kickerScale = 0.8 + 0.2 * settle(frame);
  const kickerOp = interpolate(frame, [0, 10], [0, 1], CLAMP);
  const ruleW = interpolate(frame, [24, 36], [0, 240], { ...CLAMP, easing: EASE_OUT });
  const hl = interpolate(frame, [45, 57], [0, 1], { ...CLAMP, easing: EASE_OUT });
  const ex = exitP(frame, durationInFrames, 14);
  const target = (highlightWord || "").toLowerCase();

  return (
    <div style={{ ...fillCol, transform: `translateY(${-80 * ex}px)`, opacity: 1 - ex }}>
      <div
        style={{
          transform: `scale(${kickerScale})`,
          opacity: kickerOp,
          background: INFO_T.color.accent4,
          color: INFO_T.color.ink,
          border: `${INFO_T.stroke.med}px solid ${INFO_T.color.ink}`,
          borderRadius: INFO_T.radius.chip,
          boxShadow: INFO_T.shadow,
          fontFamily: INFO_T.font.body,
          fontWeight: 700,
          fontSize: 14,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          padding: "8px 24px",
        }}
      >
        {kicker}
      </div>
      <h1
        style={{
          fontFamily: INFO_T.font.display,
          fontWeight: 900,
          fontSize: 80,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          color: INFO_T.color.ink,
          textAlign: "center",
          maxWidth: "82%",
          margin: `${INFO_T.space.xl}px 0 0`,
        }}
      >
        {words.map((w, i) => {
          const d = i * 5; // 5f per word
          const y = interpolate(frame, [d, d + 18], [60, 0], { ...CLAMP, easing: EASE_OUT });
          const o = interpolate(frame, [d, d + 14], [0, 1], CLAMP);
          const isHl = target !== "" && w.replace(/[^\w]/g, "").toLowerCase() === target;
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                position: "relative",
                transform: `translateY(${y}px)`,
                opacity: o,
                marginRight: i === words.length - 1 ? 0 : "0.26em",
                padding: "0 0.06em",
              }}
            >
              {isHl ? (
                <span
                  style={{
                    position: "absolute",
                    left: "-0.08em",
                    right: "-0.08em",
                    top: "14%",
                    bottom: "2%",
                    background: INFO_T.color.accent4,
                    borderRadius: 8,
                    transform: `rotate(-1.5deg) scaleX(${hl})`,
                    transformOrigin: "left center",
                  }}
                />
              ) : null}
              <span style={{ position: "relative" }}>{w}</span>
            </span>
          );
        })}
      </h1>
      <div
        style={{
          width: ruleW,
          height: INFO_T.stroke.med,
          background: accent,
          borderRadius: 2,
          marginTop: INFO_T.space.xl,
        }}
      />
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 2.2 Animated Stat Counter                                           */
/* ------------------------------------------------------------------ */

export interface StatCounterProps extends BlockProps {
  value: number;
  prefix?: string;
  suffix?: string; // rendered in ink at 50% size
  label: string;
  decimals?: number;
}

export const StatCounter: React.FC<StatCounterProps> = ({
  frame,
  durationInFrames,
  accent = INFO_T.color.accent,
  value,
  prefix = "",
  suffix = "",
  label,
  decimals = 0,
}) => {
  // Number counts 0→target over 45f ease-out; tabular-nums kills the jitter.
  const cv = interpolate(frame, [0, 45], [0, value], { ...CLAMP, easing: EASE_OUT });
  const shown = decimals > 0 ? cv.toFixed(decimals) : Math.round(cv).toLocaleString("en-US");
  // One 1.06→1.0 settle after landing (f45+), spring, no bounce.
  const numScale =
    frame < 45
      ? interpolate(frame, [38, 45], [1, 1.06], CLAMP)
      : 1 + 0.06 * (1 - settle(frame, 45));
  const labelOp = interpolate(frame, [30, 42], [0, 1], CLAMP);
  const labelY = interpolate(frame, [30, 42], [10, 0], { ...CLAMP, easing: EASE_OUT });
  const ex = exitP(frame, durationInFrames, 10);

  return (
    <div style={{ ...fillCol, opacity: 1 - ex, transform: `scale(${1 - 0.05 * ex})` }}>
      <div
        style={{
          fontFamily: INFO_T.font.display,
          fontWeight: 900,
          fontSize: 132,
          lineHeight: 1,
          letterSpacing: "-0.02em",
          color: accent,
          fontVariantNumeric: "tabular-nums",
          transform: `scale(${numScale})`,
        }}
      >
        {prefix}
        {shown}
        <span style={{ fontSize: "0.5em", color: INFO_T.color.ink }}>{suffix}</span>
      </div>
      <div
        style={{
          marginTop: INFO_T.space.lg,
          fontFamily: INFO_T.font.body,
          fontWeight: 600,
          fontSize: 26,
          color: INFO_T.color.inkSoft,
          textAlign: "center",
          maxWidth: "62%",
          opacity: labelOp,
          transform: `translateY(${labelY}px)`,
        }}
      >
        {label}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 2.3 Donut / Percentage Ring                                         */
/* ------------------------------------------------------------------ */

export interface DonutPercentProps extends BlockProps {
  percent: number; // 0–100
  title: string;
  text: string;
}

export const DonutPercent: React.FC<DonutPercentProps> = ({
  frame,
  durationInFrames,
  accent = INFO_T.color.accent,
  percent,
  title,
  text,
}) => {
  const SIZE = 340;
  const STROKE = 30;
  const r = (SIZE - STROKE) / 2;
  const c = 2 * Math.PI * r;
  const ex = exitP(frame, durationInFrames, 12);
  // Arc sweeps over 50f ease-out; number counts in sync. Exit un-sweeps 20%.
  const sweep =
    interpolate(frame, [0, 50], [0, percent / 100], { ...CLAMP, easing: EASE_OUT }) *
    (1 - 0.2 * ex);
  const num = Math.round(interpolate(frame, [0, 50], [0, percent], { ...CLAMP, easing: EASE_OUT }));
  // Barely-perceptible idle tick: ±0.5°, 90f period.
  const wobble = 0.5 * Math.sin((frame * 2 * Math.PI) / 90);
  const tIn = interpolate(frame, [20, 38], [0, 1], { ...CLAMP, easing: EASE_OUT });

  return (
    <div
      style={{
        ...fillCol,
        flexDirection: "row",
        gap: INFO_T.space.xxl,
        opacity: 1 - ex,
      }}
    >
      <div style={{ position: "relative", width: SIZE, height: SIZE, flex: "none" }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={r}
            fill="none"
            stroke={inkAlpha(0.08)}
            strokeWidth={STROKE}
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={r}
            fill="none"
            stroke={accent}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${c * sweep} ${c}`}
            transform={`rotate(${-90 + wobble} ${SIZE / 2} ${SIZE / 2})`}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: INFO_T.font.display,
            fontWeight: 900,
            fontSize: 68,
            letterSpacing: "-0.02em",
            color: INFO_T.color.ink,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {num}%
        </div>
      </div>
      <div
        style={{
          maxWidth: 420,
          transform: `translateX(${40 * (1 - tIn)}px)`,
          opacity: tIn,
        }}
      >
        <div
          style={{
            fontFamily: INFO_T.font.display,
            fontWeight: 900,
            fontSize: 34,
            letterSpacing: "-0.02em",
            color: INFO_T.color.ink,
            marginBottom: INFO_T.space.md,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: INFO_T.font.body,
            fontWeight: 500,
            fontSize: 21,
            lineHeight: 1.55,
            color: INFO_T.color.inkSoft,
          }}
        >
          {text}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 2.4 Bar Chart (ranked)                                              */
/* ------------------------------------------------------------------ */

export interface BarDatum {
  label: string;
  value: number;
  display?: string; // shown at the bar tip instead of the raw count
}

export interface BarRaceProps extends BlockProps {
  title?: string;
  bars: BarDatum[]; // max 5, pre-ranked (index 0 = top = accent)
  maxValue?: number;
}

export const BarRace: React.FC<BarRaceProps> = ({
  frame,
  durationInFrames,
  accent = INFO_T.color.accent,
  title,
  bars,
  maxValue,
}) => {
  const maxV = Math.max(maxValue ?? 0, ...bars.map((b) => b.value), 1);
  const n = bars.length;
  // Baseline (thick stroke) draws in first, 0–10f.
  const baseGrow = interpolate(frame, [0, 10], [0, 1], { ...CLAMP, easing: EASE_OUT });
  const titleOp = interpolate(frame, [0, 12], [0, 1], CLAMP);
  const exAll = exitP(frame, durationInFrames, 12);

  return (
    <div style={{ ...fillCol, gap: 0 }}>
      {title ? (
        <div
          style={{
            fontFamily: INFO_T.font.display,
            fontWeight: 900,
            fontSize: 34,
            letterSpacing: "-0.02em",
            color: INFO_T.color.ink,
            marginBottom: INFO_T.space.xl,
            opacity: titleOp * (1 - exAll),
          }}
        >
          {title}
        </div>
      ) : null}
      <div style={{ position: "relative", width: 880 }}>
        <div
          style={{
            position: "absolute",
            left: 218,
            top: -6,
            bottom: -6,
            width: INFO_T.stroke.thick,
            background: INFO_T.color.ink,
            borderRadius: 3,
            transform: `scaleY(${baseGrow * (1 - exAll)})`,
            transformOrigin: "top",
          }}
        />
        {bars.map((b, i) => {
          const start = i * 6; // 6f sibling stagger
          const grow = interpolate(frame, [start, start + 30], [0, 1], {
            ...CLAMP,
            easing: EASE_OUT,
          });
          // Exit: bars shrink back staggered 4f, 15f each.
          let shrink = 1;
          if (durationInFrames != null) {
            const s = durationInFrames - 15 - (n - 1 - i) * 4;
            shrink =
              1 - interpolate(frame, [s, s + 15], [0, 1], { ...CLAMP, easing: EASE_IN });
          }
          const p = (b.value / maxV) * 0.92;
          const reach = grow * shrink;
          const count = Math.round(b.value * grow);
          const tip = b.display != null && grow >= 1 ? b.display : count.toLocaleString("en-US");
          const isTop = i === 0;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                height: 46,
                marginBottom: i === n - 1 ? 0 : 18,
              }}
            >
              <div
                style={{
                  width: 200,
                  textAlign: "right",
                  paddingRight: INFO_T.space.lg,
                  fontFamily: INFO_T.font.body,
                  fontWeight: 700,
                  fontSize: 20,
                  color: INFO_T.color.ink,
                  opacity: Math.min(1, grow * 2) * shrink,
                  flex: "none",
                }}
              >
                {b.label}
              </div>
              <div style={{ position: "relative", flex: 1, height: 42, marginLeft: 24 }}>
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    height: "100%",
                    width: `${p * 100}%`,
                    background: isTop ? accent : inkAlpha(0.15),
                    border: `${INFO_T.stroke.med}px solid ${INFO_T.color.ink}`,
                    borderRadius: INFO_T.radius.bar,
                    transform: `scaleX(${reach})`,
                    transformOrigin: "left center",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: `calc(${p * reach * 100}% + 14px)`,
                    top: 0,
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    fontFamily: INFO_T.font.mono,
                    fontWeight: 700,
                    fontSize: 20,
                    color: INFO_T.color.ink,
                    fontVariantNumeric: "tabular-nums",
                    opacity: Math.min(1, grow * 3) * shrink,
                    whiteSpace: "nowrap",
                  }}
                >
                  {tip}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 2.5 Icon List (3–4 points)                                          */
/* ------------------------------------------------------------------ */

export interface IconListItem {
  heading: string;
  sub: string;
  iconSrc?: string; // resolved src (e.g. staticFile("generated/coin.png"))
  /** Pipeline S-snake: 2–3 word label on the connector to the next step */
  flowLabel?: string;
}

export interface IconListProps extends BlockProps {
  title?: string;
  items: IconListItem[];
  activeIndex?: number; // narration highlight — others dim to 60%
}

const ICON_FALLBACKS = [INFO_T.color.accent, INFO_T.color.accent2, INFO_T.color.accent3, INFO_T.color.accent4];

export const IconList: React.FC<IconListProps> = ({
  frame,
  durationInFrames,
  accent = INFO_T.color.accent,
  title,
  items,
  activeIndex,
}) => {
  const ex = exitP(frame, durationInFrames, 12);
  const allEntered = frame > items.length * 10 + 24;
  const titleOp = interpolate(frame, [0, 12], [0, 1], CLAMP);

  return (
    <div
      style={{
        ...fillCol,
        opacity: 1 - ex,
        transform: `translateY(${20 * ex}px)`,
      }}
    >
      {title ? (
        <div
          style={{
            fontFamily: INFO_T.font.display,
            fontWeight: 900,
            fontSize: 34,
            letterSpacing: "-0.02em",
            color: INFO_T.color.ink,
            marginBottom: INFO_T.space.xl,
            opacity: titleOp,
          }}
        >
          {title}
        </div>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
        {items.map((it, i) => {
          const d = i * 10; // rows staggered 10f apart
          // Chips are one of the two sanctioned bouncy elements (damping ~12).
          const chipScale = pop(frame, d, 12);
          const tIn = interpolate(frame, [d + 4, d + 18], [0, 1], { ...CLAMP, easing: EASE_OUT });
          const isActive = activeIndex === i;
          const dim = allEntered && activeIndex != null && !isActive ? 0.6 : 1;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 28, opacity: dim }}>
              <div
                style={{
                  ...infoCardStyle,
                  borderColor: isActive ? accent : INFO_T.color.ink,
                  borderRadius: INFO_T.radius.icon,
                  width: 78,
                  height: 78,
                  flex: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: `scale(${chipScale * (isActive ? 1.05 : 1)})`,
                }}
              >
                {it.iconSrc ? (
                  <Img
                    src={it.iconSrc}
                    style={{ width: "72%", height: "72%", objectFit: "contain" }}
                  />
                ) : (
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 9,
                      background: ICON_FALLBACKS[i % ICON_FALLBACKS.length],
                      border: `${INFO_T.stroke.med}px solid ${INFO_T.color.ink}`,
                      transform: "rotate(-6deg)",
                    }}
                  />
                )}
              </div>
              <div style={{ transform: `translateX(${24 * (1 - tIn)}px)`, opacity: tIn, width: 560 }}>
                <div
                  style={{
                    fontFamily: INFO_T.font.body,
                    fontWeight: 700,
                    fontSize: 26,
                    color: INFO_T.color.ink,
                  }}
                >
                  {it.heading}
                </div>
                <div
                  style={{
                    fontFamily: INFO_T.font.body,
                    fontWeight: 500,
                    fontSize: 19,
                    color: INFO_T.color.inkSoft,
                    marginTop: 4,
                  }}
                >
                  {it.sub}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 2.6 Comparison Split (A vs B)                                       */
/* ------------------------------------------------------------------ */

export interface ComparisonSplitProps extends BlockProps {
  leftTitle: string;
  rightTitle: string;
  rows: { left: string; right: string }[];
  vsLabel?: string;
}

export const ComparisonSplit: React.FC<ComparisonSplitProps> = ({
  frame,
  durationInFrames,
  accent = INFO_T.color.accent,
  leftTitle,
  rightTitle,
  rows,
  vsLabel = "VS",
}) => {
  const dividerGrow = interpolate(frame, [0, 14], [0, 1], { ...CLAMP, easing: EASE_OUT });
  const leftX = interpolate(frame, [6, 24], [-60, 0], { ...CLAMP, easing: EASE_OUT });
  const leftOp = interpolate(frame, [6, 20], [0, 1], CLAMP);
  const rightX = interpolate(frame, [12, 30], [60, 0], { ...CLAMP, easing: EASE_OUT });
  const rightOp = interpolate(frame, [12, 26], [0, 1], CLAMP);
  const vsScale = settle(frame, 26);
  const ex = exitP(frame, durationInFrames, 14);

  const card = (side: "l" | "r") => {
    const isL = side === "l";
    return (
      <div
        style={{
          ...infoCardStyle,
          width: 420,
          padding: "28px 32px",
          transform: `translateX(${(isL ? leftX : rightX) + (isL ? -70 : 70) * ex}px)`,
          opacity: (isL ? leftOp : rightOp) * (1 - ex),
        }}
      >
        <div
          style={{
            fontFamily: INFO_T.font.display,
            fontWeight: 900,
            fontSize: 30,
            letterSpacing: "-0.02em",
            color: isL ? accent : INFO_T.color.accent2,
            marginBottom: INFO_T.space.md,
          }}
        >
          {isL ? leftTitle : rightTitle}
        </div>
        {rows.map((r, i) => {
          const rowOp = interpolate(frame, [30 + i * 6, 42 + i * 6], [0, 1], CLAMP);
          return (
            <div
              key={i}
              style={{
                fontFamily: INFO_T.font.body,
                fontWeight: 600,
                fontSize: 20,
                color: INFO_T.color.ink,
                padding: "13px 0",
                borderTop: i === 0 ? "none" : `${INFO_T.stroke.thin}px solid ${inkAlpha(0.25)}`,
                opacity: rowOp,
              }}
            >
              {isL ? r.left : r.right}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ ...fillCol, flexDirection: "row", gap: 110 }}>
      {card("l")}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "16%",
          bottom: "16%",
          width: INFO_T.stroke.thick,
          marginLeft: -INFO_T.stroke.thick / 2,
          background: INFO_T.color.ink,
          borderRadius: 3,
          transform: `scaleY(${dividerGrow * (1 - ex)})`,
          transformOrigin: "top",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${vsScale * (1 - ex)})`,
          background: INFO_T.color.ink,
          color: INFO_T.color.white,
          fontFamily: INFO_T.font.display,
          fontWeight: 900,
          fontSize: 22,
          borderRadius: INFO_T.radius.chip,
          padding: "12px 22px",
          boxShadow: INFO_T.shadow,
        }}
      >
        {vsLabel}
      </div>
      {card("r")}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 2.7 Timeline Strip                                                  */
/* ------------------------------------------------------------------ */

export interface TimelineNode {
  year: string;
  caption: string;
  iconSrc?: string;
}

export interface TimelineStripProps extends BlockProps {
  nodes: TimelineNode[]; // 3–5
  beatFrames?: number; // frames between camera moves (default 26)
  /** When set, step highlight follows audio-aligned local frame offsets. */
  stepStartsLocalFrames?: number[];
}

export const TimelineStrip: React.FC<TimelineStripProps> = ({
  frame,
  durationInFrames,
  accent = INFO_T.color.accent,
  nodes,
  beatFrames = 26,
}) => {
  const n = Math.max(nodes.length, 2);
  const spacing = 320;
  const lineGrow = interpolate(frame, [0, 30], [0, 1], { ...CLAMP, easing: EASE_INOUT });
  const ex = exitP(frame, durationInFrames, 12);

  // Camera: continuous fractional index, holding on each node then easing
  // (25f-ish inOut moves) to the next between narration beats.
  const input: number[] = [0];
  const output: number[] = [0];
  for (let k = 1; k < n; k++) {
    const s = 45 + beatFrames * (k - 1);
    input.push(s, s + 20);
    output.push(k - 1, k);
  }
  const idxFloat =
    n > 1 ? interpolate(frame, input, output, { ...CLAMP, easing: EASE_INOUT }) : 0;
  const camX = -idxFloat * spacing + 40 * ex;

  return (
    <div style={{ position: "absolute", inset: 0, opacity: 1 - ex }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "56%",
          transform: `translateX(${camX}px)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: -spacing * 0.35,
            top: -INFO_T.stroke.thick / 2,
            width: spacing * (n - 1) + spacing * 0.7,
            height: INFO_T.stroke.thick,
            background: INFO_T.color.ink,
            borderRadius: 3,
            transform: `scaleX(${lineGrow})`,
            transformOrigin: "left center",
          }}
        />
        {nodes.map((nd, i) => {
          const frac = n > 1 ? i / (n - 1) : 0;
          const popDelay = 2 + 30 * frac; // pops as the wipe reaches it
          const nodeIn = settle(frame, popDelay);
          const labelOp = interpolate(frame, [popDelay + 10, popDelay + 18], [0, 1], CLAMP);
          const above = i % 2 === 0;
          // Active node scales 1.3 + fills accent by camera proximity.
          const prox = Math.max(0, 1 - Math.abs(idxFloat - i));
          const scale = nodeIn * (1 + 0.3 * prox);
          return (
            <div key={i} style={{ position: "absolute", left: i * spacing, top: 0 }}>
              <div
                style={{
                  position: "absolute",
                  left: -14,
                  top: -14,
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: prox > 0.5 ? accent : INFO_T.color.ink,
                  border: `6px solid ${INFO_T.color.white}`,
                  boxShadow: `0 0 0 ${INFO_T.stroke.med}px ${INFO_T.color.ink}`,
                  transform: `scale(${scale})`,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: -110,
                  width: 220,
                  textAlign: "center",
                  top: above ? -118 : 42,
                  opacity: labelOp,
                }}
              >
                <div
                  style={{
                    fontFamily: INFO_T.font.display,
                    fontWeight: 900,
                    fontSize: 30,
                    letterSpacing: "-0.02em",
                    color: accent,
                  }}
                >
                  {nd.year}
                </div>
                <div
                  style={{
                    fontFamily: INFO_T.font.body,
                    fontWeight: 500,
                    fontSize: 17,
                    color: INFO_T.color.inkSoft,
                    marginTop: 4,
                    lineHeight: 1.35,
                  }}
                >
                  {nd.caption}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 2.8 Quote Card                                                      */
/* ------------------------------------------------------------------ */

export interface QuoteCardProps extends BlockProps {
  lines: string[]; // max 3 pre-broken lines
  name: string;
  role: string;
}

export const QuoteCard: React.FC<QuoteCardProps> = ({
  frame,
  durationInFrames,
  accent = INFO_T.color.accent,
  lines,
  name,
  role,
}) => {
  const markIn = settle(frame);
  const attribAt = 10 + (lines.length - 1) * 8 + 20 + 10;
  const attribOp = interpolate(frame, [attribAt, attribAt + 12], [0, 1], CLAMP);
  // Exit: content fades first; the quote mark exits last (5f delay).
  const exBody =
    durationInFrames == null
      ? 0
      : interpolate(frame, [durationInFrames - 15, durationInFrames - 4], [0, 1], {
          ...CLAMP,
          easing: EASE_IN,
        });
  const exMark =
    durationInFrames == null
      ? 0
      : interpolate(frame, [durationInFrames - 10, durationInFrames - 1], [0, 1], {
          ...CLAMP,
          easing: EASE_IN,
        });

  return (
    <div style={{ ...fillCol, alignItems: "flex-start", paddingLeft: "14%" }}>
      <div
        style={{
          fontFamily: INFO_T.font.display,
          fontWeight: 900,
          fontSize: 130,
          lineHeight: 0.6,
          color: accent,
          transform: `rotate(-8deg) translateY(${-40 * (1 - markIn)}px)`,
          opacity: markIn * (1 - exMark),
          marginBottom: INFO_T.space.lg,
        }}
      >
        {"“"}
      </div>
      <div style={{ opacity: 1 - exBody }}>
        {lines.map((ln, i) => {
          const d = 10 + i * 8; // line-by-line, 8f stagger
          const w = interpolate(frame, [d, d + 20], [0, 100], { ...CLAMP, easing: EASE_OUT });
          return (
            <div
              key={i}
              style={{
                fontFamily: INFO_T.font.display,
                fontWeight: 900,
                fontSize: 42,
                lineHeight: 1.3,
                letterSpacing: "-0.02em",
                color: INFO_T.color.ink,
                clipPath: `inset(0% ${100 - w}% 0% 0%)`,
              }}
            >
              {ln}
            </div>
          );
        })}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginTop: INFO_T.space.xl,
            opacity: attribOp,
          }}
        >
          <div style={{ width: 12, height: 12, background: accent, flex: "none" }} />
          <span
            style={{
              fontFamily: INFO_T.font.body,
              fontWeight: 600,
              fontSize: 22,
              color: INFO_T.color.ink,
            }}
          >
            {name}
          </span>
          <span
            style={{
              fontFamily: INFO_T.font.body,
              fontWeight: 500,
              fontSize: 20,
              color: INFO_T.color.inkSoft,
            }}
          >
            {role}
          </span>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 2.10 Outro CTA                                                      */
/* ------------------------------------------------------------------ */

export interface OutroCTAProps extends BlockProps {
  channel: string;
  channelTagline?: string;
  ctaText?: string;
  /** Empty 16:9 slots for YouTube end-screen video placement (no titles). */
  videoSlots?: number;
  slotTints?: string[];
}

export const OutroCTA: React.FC<OutroCTAProps> = ({
  frame,
  accent = INFO_T.color.accent,
  channel,
  ctaText = "SUBSCRIBE",
}) => {
  const markIn = settle(frame);
  // The ONE overshooting element allowed (damping 10).
  const btnIn = pop(frame, 12, 10);
  // Idle pulse every 75f, starting after entrance.
  const pulse = 1 + 0.02 * (1 - Math.cos((Math.max(0, frame - 60) * 2 * Math.PI) / 75));
  // Hand-cursor tap at f90 (down 6f, up 6f) — the button dips with it.
  const dip = interpolate(frame, [84, 90, 96], [1, 0.95, 1], { ...CLAMP, easing: EASE_INOUT });
  const cursorY = interpolate(frame, [84, 90, 96], [0, -14, 0], { ...CLAMP, easing: EASE_INOUT });
  const cursorOp = interpolate(frame, [68, 78], [0, 1], CLAMP);

  return (
    <div style={{ ...fillCol, gap: INFO_T.space.xl }}>
      <div
        style={{
          ...infoCardStyle,
          width: 92,
          height: 92,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: INFO_T.font.display,
          fontWeight: 900,
          fontSize: 40,
          color: INFO_T.color.ink,
          transform: `scale(${markIn}) rotate(-3deg)`,
        }}
      >
        {channel.charAt(0).toUpperCase()}
      </div>
      <div style={{ position: "relative" }}>
        <div
          style={{
            background: accent,
            color: INFO_T.color.white,
            fontFamily: INFO_T.font.body,
            fontWeight: 800,
            fontSize: 30,
            letterSpacing: "0.1em",
            padding: "18px 52px",
            borderRadius: INFO_T.radius.chip,
            border: `${INFO_T.stroke.thick}px solid ${INFO_T.color.ink}`,
            boxShadow: INFO_T.shadow,
            transform: `scale(${btnIn * pulse * dip})`,
          }}
        >
          {ctaText}
        </div>
        <div
          style={{
            position: "absolute",
            right: -34,
            bottom: -38,
            fontSize: 44,
            opacity: cursorOp,
            transform: `translateY(${cursorY}px) rotate(-12deg)`,
          }}
        >
          {"☝"}
        </div>
      </div>
      <div style={{ display: "flex", gap: INFO_T.space.xl, marginTop: INFO_T.space.md }}>
        {[0, 1].map((i) => {
          const wipe = interpolate(frame, [24 + i * 8, 38 + i * 8], [0, 1], {
            ...CLAMP,
            easing: EASE_OUT,
          });
          return (
            <div
              key={i}
              style={{
                width: 300,
                height: 168,
                border: `${INFO_T.stroke.thick}px solid ${INFO_T.color.ink}`,
                borderRadius: INFO_T.radius.card,
                transform: `scaleX(${wipe})`,
                transformOrigin: "left center",
                opacity: wipe,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderTop: "16px solid transparent",
                  borderBottom: "16px solid transparent",
                  borderLeft: `26px solid ${inkAlpha(0.25)}`,
                  marginLeft: 6,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
