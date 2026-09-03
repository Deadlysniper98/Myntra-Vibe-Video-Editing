// ─────────────────────────────────────────────────────────────────────────────
// .motion — a constrained, renderer-agnostic spec for interactive vector animation
// ─────────────────────────────────────────────────────────────────────────────
//
// This is the SECOND output type of Vibe, alongside the Remotion *video* output.
// A .motion file is NOT a video. It describes shapes, timelines, and a state machine
// that a lightweight runtime can play at 60fps and drive with live inputs:
//
//   • web preview  → SVG / Canvas
//   • production   → React Native Skia (`CustomMotionView`)
//
// Because it must run on a real-time vector engine from a tiny portable spec, its
// capabilities are INTENTIONALLY limited. This ceiling is the feature, not a gap —
// it's what keeps a .motion file small, deterministic, and cheap to render.
//
//   ✓ vector shapes (path / rectangle / circle), solid hex fills
//   ✓ tweening transform + opacity + fill over time, with named easing
//   ✓ a state machine: boolean / number / trigger inputs → transitions → states
//   ✗ NO raster/video effects: blur, motion blur, drop shadows, filters, textures
//   ✗ NO audio, NO per-pixel compositing, NO gradients, NO arbitrary code
//
// Anything richer belongs in the *video* output (Remotion), never here.

export const MOTION_VERSION = "1.0.0";

// The ONLY properties a keyframe may animate. Keeping this whitelist tiny is what
// makes .motion portable across renderers and predictable at runtime.
//   - numeric props interpolate linearly (with easing)
//   - "fill" interpolates in RGB space between two hex colors
export type AnimatableProperty =
  | "x"
  | "y"
  | "scaleX"
  | "scaleY"
  | "rotation" // degrees
  | "opacity" // 0..1
  | "fill"; // #rrggbb

export const ANIMATABLE_PROPERTIES: AnimatableProperty[] = [
  "x",
  "y",
  "scaleX",
  "scaleY",
  "rotation",
  "opacity",
  "fill",
];

export type ShapeType = "path" | "rectangle" | "circle";

// A fixed set of named curves every renderer must implement identically. v1 avoids
// arbitrary cubic-bezier strings on purpose — a closed set keeps web + Skia in exact
// agreement (and matches the "very limited" goal). Add curves here deliberately.
export type Easing = "linear" | "easeIn" | "easeOut" | "easeInOut" | "spring";

export interface Transform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number; // degrees, around the shape's local origin
}

export interface Shape {
  id: string;
  type: ShapeType;
  fill: string; // #rrggbb (or #rgb)
  opacity?: number; // 0..1, default 1
  transform: Transform;
  // Geometry, by `type`:
  d?: string; // type "path": SVG path data, e.g. "M0 0 L100 0 100 40 0 40 Z"
  points?: number[]; // type "path": optional flat [x0,y0,x1,y1,…] polyline alternative to `d`
  width?: number; // type "rectangle"
  height?: number; // type "rectangle"
  radius?: number; // type "circle"
}

export interface Keyframe {
  timeMs: number;
  value: number | string; // number for numeric props; hex string for "fill"
  easing?: Easing; // curve used to reach THIS keyframe from the previous one; default "linear"
}

// timelines[name].keyframes[shapeId][property] = Keyframe[]
export type TrackKeyframes = Partial<Record<AnimatableProperty, Keyframe[]>>;

export interface Timeline {
  durationMs: number;
  loop?: boolean; // default false
  keyframes: Record<string, TrackKeyframes>; // shapeId → per-property keyframe tracks
}

export type InputType = "boolean" | "number" | "trigger";

export interface Input {
  type: InputType;
  defaultValue?: boolean | number; // "trigger" inputs carry no value
}

export interface State {
  timeline: string; // timeline played while this state is active
}

export interface Transition {
  from: string; // source state id, or "*" for "from any state"
  to: string; // destination state id
  // A tiny condition expression evaluated against inputs, e.g.
  //   "isPressed == true"   "progress >= 1"   "tap"  (a trigger name on its own)
  condition: string;
}

export interface StateMachine {
  initial?: string; // starting state id (defaults to the first state)
  inputs: Record<string, Input>;
  states: Record<string, State>;
  transitions: Transition[];
}

export interface MotionMeta {
  version: string;
  baseWidth: number;
  baseHeight: number;
  name?: string;
}

// The root .motion document — exactly the four keys the compiler must emit.
export interface MotionDoc {
  meta: MotionMeta;
  canvas: { shapes: Shape[] };
  timelines: Record<string, Timeline>;
  stateMachine: StateMachine;
}
