// ─────────────────────────────────────────────────────────────────────────────
// MotionRuntime — the platform-agnostic engine behind a .motion document.
//
// Zero platform deps (no React, no Skia, no react-native) ON PURPOSE: this is the
// shared core that both the RN Skia component and a future web/SVG preview drive,
// so they stay in exact agreement. It samples keyframes, runs the state machine,
// and resolves every shape's current transform/opacity/fill for a renderer to paint.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AnimatableProperty,
  Easing,
  Keyframe,
  MotionDoc,
} from "./schema";

export interface ResolvedShape {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  fill: string;
}
export type ResolvedScene = Record<string, ResolvedShape>;

// ── Easing curves (must match every renderer 1:1) ──
const EASING: Record<Easing, (t: number) => number> = {
  linear: (t) => t,
  easeIn: (t) => t * t * t,
  easeOut: (t) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  // Static approximation of a spring (ease-out with a small overshoot). A true
  // velocity-based spring is a v2 item; this keeps duration-based timelines exact.
  spring: (t) => {
    const c = 1.70158 * 1.1;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  },
};

// ── Color interpolation in RGB space ──
function parseHex(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function toHex(r: number, g: number, b: number): string {
  const c = (v: number) =>
    Math.round(Math.max(0, Math.min(255, v)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
function lerpColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return toHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

// ── Sample one keyframe track at time t (ms) ──
export function sampleTrack(track: Keyframe[], t: number): number | string {
  if (track.length === 0) return 0;
  if (t <= track[0].timeMs) return track[0].value;
  const last = track[track.length - 1];
  if (t >= last.timeMs) return last.value;
  for (let i = 0; i < track.length - 1; i++) {
    const k0 = track[i];
    const k1 = track[i + 1];
    if (t >= k0.timeMs && t <= k1.timeMs) {
      const span = k1.timeMs - k0.timeMs || 1;
      const localT = (t - k0.timeMs) / span;
      const eased = (EASING[k1.easing ?? "linear"] ?? EASING.linear)(localT);
      if (typeof k0.value === "string" || typeof k1.value === "string") {
        return lerpColor(String(k0.value), String(k1.value), eased);
      }
      return (k0.value as number) + ((k1.value as number) - (k0.value as number)) * eased;
    }
  }
  return last.value;
}

type InputValues = Record<string, boolean | number>;

// ── Condition grammar (intentionally tiny): ──
//   "name == true" | "name != 3" | "name >= 5" | "name < 2" | bare "triggerName"
function evalCondition(
  cond: string,
  inputs: InputValues,
  fired: Set<string>,
): boolean {
  const c = cond.trim();
  if (/^[A-Za-z_]\w*$/.test(c)) {
    // a bare identifier = a fired trigger, or a boolean input that is true
    return fired.has(c) || inputs[c] === true;
  }
  const m = c.match(/^([A-Za-z_]\w*)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (!m) return false;
  const [, name, op, rhsRaw] = m;
  const lhs = inputs[name];
  let rhs: boolean | number | string = rhsRaw.trim();
  if (rhs === "true") rhs = true;
  else if (rhs === "false") rhs = false;
  else if (!Number.isNaN(Number(rhs))) rhs = Number(rhs);
  switch (op) {
    case "==":
      return lhs === rhs;
    case "!=":
      return lhs !== rhs;
    case ">=":
      return Number(lhs) >= Number(rhs);
    case "<=":
      return Number(lhs) <= Number(rhs);
    case ">":
      return Number(lhs) > Number(rhs);
    case "<":
      return Number(lhs) < Number(rhs);
    default:
      return false;
  }
}

export class MotionRuntime {
  private doc: MotionDoc;
  private inputs: InputValues = {};
  private fired = new Set<string>();
  private stateId: string;
  private timeMs = 0;
  private playing: boolean;

  constructor(doc: MotionDoc, autoPlay = true) {
    this.doc = doc;
    this.playing = autoPlay;
    for (const [name, def] of Object.entries(doc.stateMachine.inputs)) {
      if (def.type === "boolean") this.inputs[name] = (def.defaultValue as boolean) ?? false;
      else if (def.type === "number") this.inputs[name] = (def.defaultValue as number) ?? 0;
      // triggers carry no stored value
    }
    this.stateId =
      doc.stateMachine.initial ?? Object.keys(doc.stateMachine.states)[0];
    this.settleTransitions();
  }

  get currentState(): string {
    return this.stateId;
  }

  setInput(name: string, value: boolean | number): void {
    this.inputs[name] = value;
    this.settleTransitions();
  }

  fireTrigger(name: string): void {
    this.fired.add(name);
    this.settleTransitions();
  }

  play(): void {
    this.playing = true;
  }
  pause(): void {
    this.playing = false;
  }

  private currentTimeline() {
    const st = this.doc.stateMachine.states[this.stateId];
    return st ? this.doc.timelines[st.timeline] : undefined;
  }

  // Follow transitions until none fire (handles chained transitions in one settle).
  private settleTransitions(): void {
    for (let hop = 0; hop < 8; hop++) {
      const tr = this.doc.stateMachine.transitions.find(
        (t) =>
          (t.from === this.stateId || t.from === "*") &&
          t.to !== this.stateId &&
          evalCondition(t.condition, this.inputs, this.fired),
      );
      if (!tr) break;
      this.stateId = tr.to;
      this.timeMs = 0;
    }
    // triggers are momentary — consumed after every settle
    this.fired.clear();
  }

  tick(dtMs: number): void {
    if (this.playing) {
      const tl = this.currentTimeline();
      if (tl) {
        this.timeMs += dtMs;
        if (this.timeMs >= tl.durationMs) {
          this.timeMs = tl.loop ? this.timeMs % tl.durationMs : tl.durationMs;
        }
      }
    }
    this.settleTransitions();
  }

  // Current paint state for every shape (base transform/fill, overridden by any
  // active keyframe track on the current state's timeline).
  resolve(): ResolvedScene {
    const tl = this.currentTimeline();
    const out: ResolvedScene = {};
    for (const shape of this.doc.canvas.shapes) {
      const r: ResolvedShape = {
        x: shape.transform.x,
        y: shape.transform.y,
        scaleX: shape.transform.scaleX,
        scaleY: shape.transform.scaleY,
        rotation: shape.transform.rotation,
        opacity: shape.opacity ?? 1,
        fill: shape.fill,
      };
      const tracks = tl?.keyframes[shape.id];
      if (tracks) {
        for (const prop of Object.keys(tracks) as AnimatableProperty[]) {
          const track = tracks[prop];
          if (!track || track.length === 0) continue;
          const v = sampleTrack(track, this.timeMs);
          if (prop === "fill") r.fill = String(v);
          else (r as Record<string, number>)[prop] = Number(v);
        }
      }
      out[shape.id] = r;
    }
    return out;
  }
}
