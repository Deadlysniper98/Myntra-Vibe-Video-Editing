import { Easing, interpolate } from "remotion";

// ════════════════════════════════════════════════════════════════════════════
// Motion language — frame-based implementation of Skill/MotionDesign.md.
// Single source of truth for easing curves and the §3 transition matrix so every
// composition speaks the same cinematic vocabulary (Swift / Pop / Drift + Cases
// A / B / C). All ms values from the spec are converted to frames via `ms()`.
// ════════════════════════════════════════════════════════════════════════════

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// ─── §2 Global Easing Curves ────────────────────────────────────────────────
/** Quad Out (decel) — crisp, responsive general UI entry. 300–400ms. */
export const SWIFT = Easing.bezier(0.25, 1, 0.5, 1);
/** Back Out — overshoots, then settles. Modals, badges, impact moments. 450ms. */
export const POP = Easing.bezier(0.34, 1.56, 0.64, 1);
/** Quint Out — long immersive decel. Backgrounds, full-screen transitions. 600–800ms. */
export const DRIFT = Easing.bezier(0.22, 1, 0.36, 1);
/** Case A exit — "Fast Out". */
export const FAST_OUT = Easing.bezier(0.7, 0, 0.84, 0);
/** Case B exit — directional push accel. */
export const PUSH_OUT = Easing.bezier(0.3, 0, 1, 1);
/** Case B entry — directional settle decel (== the main comp's brand `EO`). */
export const PUSH_IN = Easing.bezier(0.16, 1, 0.3, 1);

/** Convert spec milliseconds → frames at the composition fps. */
export const ms = (millis: number, fps: number) => (millis / 1000) * fps;

// ─── §4 Micro-choreography — stagger offset (keep between 30–50ms) ───────────
export const staggerFrames = (index: number, fps: number, offsetMs = 40) =>
  ms(index * offsetMs, fps);

// ─── §3 Case A — Fade + Scale (the modern app standard) ─────────────────────
export type FadeScale = { opacity: number; scale: number };

/** New UI entry: opacity 0→1, scale 1.05→1 (settles from foreground). Quint Out, 400ms. */
export function fadeScaleIn(frame: number, start: number, fps: number, dur = 400): FadeScale {
  const end = start + ms(dur, fps);
  return {
    opacity: interpolate(frame, [start, end], [0, 1], { ...CLAMP, easing: DRIFT }),
    scale: interpolate(frame, [start, end], [1.05, 1], { ...CLAMP, easing: DRIFT }),
  };
}

/** Previous UI exit: opacity 1→0, scale 1→0.95 (shrinks into background). Fast Out, 200ms. */
export function fadeScaleOut(frame: number, start: number, fps: number, dur = 200): FadeScale {
  const end = start + ms(dur, fps);
  return {
    opacity: interpolate(frame, [start, end], [1, 0], { ...CLAMP, easing: FAST_OUT }),
    scale: interpolate(frame, [start, end], [1, 0.95], { ...CLAMP, easing: FAST_OUT }),
  };
}

// ─── §3 Case C — Gaussian Blur In / Out (cinematic dream style) ──────────────
export type Blurt = { opacity: number; scale: number; blur: number };

/** Entry: blur 80→0px (snaps to crisp focus), opacity 0→1, scale 0.9→1. 450ms. */
export function blurIn(frame: number, start: number, fps: number, dur = 450): Blurt {
  const end = start + ms(dur, fps);
  return {
    opacity: interpolate(frame, [start, end], [0, 1], { ...CLAMP, easing: DRIFT }),
    scale: interpolate(frame, [start, end], [0.9, 1], { ...CLAMP, easing: DRIFT }),
    blur: interpolate(frame, [start, end], [80, 0], { ...CLAMP, easing: DRIFT }),
  };
}

/** Exit: blur 0→50px, opacity 1→0, scale 1→1.1 (expands into camera). 300ms. */
export function blurOut(frame: number, start: number, fps: number, dur = 300): Blurt {
  const end = start + ms(dur, fps);
  return {
    opacity: interpolate(frame, [start, end], [1, 0], { ...CLAMP, easing: FAST_OUT }),
    scale: interpolate(frame, [start, end], [1, 1.1], { ...CLAMP, easing: FAST_OUT }),
    blur: interpolate(frame, [start, end], [0, 50], { ...CLAMP, easing: FAST_OUT }),
  };
}

// ─── §3 Case B — Directional Push + Motion Blur (premium executive look) ─────
export type Push = { opacity: number; x: number; blur: number };

/** Entry from the left: x −150→0, opacity 0→1, directional blur 40→0px. 500ms. */
export function pushIn(frame: number, start: number, fps: number, from = -150, dur = 500): Push {
  const end = start + ms(dur, fps);
  return {
    opacity: interpolate(frame, [start, end], [0, 1], { ...CLAMP, easing: PUSH_IN }),
    x: interpolate(frame, [start, end], [from, 0], { ...CLAMP, easing: PUSH_IN }),
    blur: interpolate(frame, [start, end], [40, 0], { ...CLAMP, easing: PUSH_IN }),
  };
}

/** Exit to the right: x 0→+100, opacity 1→0, directional blur 0→30px. 250ms. */
export function pushOut(frame: number, start: number, fps: number, to = 100, dur = 250): Push {
  const end = start + ms(dur, fps);
  return {
    opacity: interpolate(frame, [start, end], [1, 0], { ...CLAMP, easing: PUSH_OUT }),
    x: interpolate(frame, [start, end], [0, to], { ...CLAMP, easing: PUSH_OUT }),
    blur: interpolate(frame, [start, end], [0, 30], { ...CLAMP, easing: PUSH_OUT }),
  };
}

// ─── §2 "Dramatic Pop" — Back Out scale-in for badges / impact ──────────────
/** Scale `from`→1 with POP overshoot (~103% before settle) + opacity 0→1. 450ms. */
export function popIn(frame: number, start: number, fps: number, from = 0.7, dur = 450): FadeScale {
  const end = start + ms(dur, fps);
  return {
    opacity: interpolate(frame, [start, start + ms(200, fps)], [0, 1], CLAMP),
    scale: interpolate(frame, [start, end], [from, 1], { ...CLAMP, easing: POP }),
  };
}
