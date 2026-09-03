import type { CSSProperties } from "react";

// "Signal Flat" — design tokens for the infographic explainer system.
// Flat vector look: warm paper ground, near-black ink, one dominant accent,
// chunky rounded geometry, hard offset shadows (never soft blur).
//
// FONTS: Archivo Black / Inter / Space Grotesk are Google Fonts. They are loaded
// the same way the promo loads Inter Tight / Outfit / Bebas Neue — via @import
// lines at the top of src/index.css (see the integration snippet delivered with
// this system; the stacks below fall back gracefully until it lands).

export const INFO_T = {
  color: {
    bg: "#F7F3EC", // warm paper — primary background
    bgAlt: "#EFE9DE", // section-change background (subtle shift, not a new color)
    ink: "#1A1C2E", // near-black indigo — ALL text and strokes
    inkSoft: "#5C5F73", // captions, axis labels, secondary text
    accent: "#FF5C38", // "Signal Orange" — hero numbers, primary bars
    accent2: "#2D6BFF", // "Chart Blue" — comparisons, second data series
    accent3: "#19B27B", // "Up Green" — positive deltas, checkmarks
    accent4: "#FFC53D", // "Highlight Amber" — highlighter sweeps, callouts
    white: "#FFFFFF", // card surfaces on bg
  },
  font: {
    display: '"Archivo Black", "Arial Black", "Inter Tight", sans-serif', // titles, big stats (900 only, tight)
    body: '"Inter", "Inter Tight", system-ui, sans-serif', // everything else (500/600/700)
    mono: '"Space Grotesk", "Inter", sans-serif', // tick labels / units
  },
  stroke: {
    thick: 6, // card borders, chart baselines, icon outlines
    med: 3, // dividers, connector lines
    thin: 1.5, // grid lines at 25% opacity ink
  },
  radius: {
    card: 24,
    chip: 999, // full pill for tags/labels
    bar: 10, // bar-chart end caps
    icon: 16,
  },
  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 40, xxl: 64 }, // 4/8px rhythm
  shadow: "0 6px 0 rgba(26,28,46,0.12)", // HARD offset shadow, no blur — "sticker" look
  dotGrid: { size: 2, gap: 28, opacity: 0.04 }, // static bg texture, never animated
} as const;

export type InfoTokens = typeof INFO_T;

// Ink at an arbitrary alpha (grid lines, muted fills).
export const inkAlpha = (a: number) => `rgba(26, 28, 46, ${a})`;

// Static dot-grid texture for the paper background (bg only — never animated).
export const dotGridStyle: CSSProperties = {
  backgroundImage: `radial-gradient(circle, ${inkAlpha(INFO_T.dotGrid.opacity)} ${
    INFO_T.dotGrid.size / 2
  }px, transparent ${INFO_T.dotGrid.size / 2}px)`,
  backgroundSize: `${INFO_T.dotGrid.gap}px ${INFO_T.dotGrid.gap}px`,
};

// White "sticker" card: thick ink border + hard offset shadow.
export const infoCardStyle: CSSProperties = {
  background: INFO_T.color.white,
  border: `${INFO_T.stroke.thick}px solid ${INFO_T.color.ink}`,
  borderRadius: INFO_T.radius.card,
  boxShadow: INFO_T.shadow,
};
