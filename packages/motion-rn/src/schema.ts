// Types for the .motion format. Mirror of the canonical spec at
// `src/motion/schema.ts` (kept self-contained so this package is droppable into an
// RN app). If you change the spec, update both. See `src/motion/README.md`.

export type AnimatableProperty =
  | "x"
  | "y"
  | "scaleX"
  | "scaleY"
  | "rotation"
  | "opacity"
  | "fill";

export type ShapeType = "path" | "rectangle" | "circle";
export type Easing = "linear" | "easeIn" | "easeOut" | "easeInOut" | "spring";

export interface Transform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export interface Shape {
  id: string;
  type: ShapeType;
  fill: string;
  opacity?: number;
  transform: Transform;
  d?: string;
  points?: number[];
  width?: number;
  height?: number;
  radius?: number;
}

export interface Keyframe {
  timeMs: number;
  value: number | string;
  easing?: Easing;
}

export type TrackKeyframes = Partial<Record<AnimatableProperty, Keyframe[]>>;

export interface Timeline {
  durationMs: number;
  loop?: boolean;
  keyframes: Record<string, TrackKeyframes>;
}

export type InputType = "boolean" | "number" | "trigger";

export interface Input {
  type: InputType;
  defaultValue?: boolean | number;
}

export interface State {
  timeline: string;
}

export interface Transition {
  from: string;
  to: string;
  condition: string;
}

export interface StateMachine {
  initial?: string;
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

export interface MotionDoc {
  meta: MotionMeta;
  canvas: { shapes: Shape[] };
  timelines: Record<string, Timeline>;
  stateMachine: StateMachine;
}
