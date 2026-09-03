// Reusable animation templates the user can drop onto the timeline as a starting
// section, then refine by prompting. Today a drop adds a planned timeline segment;
// the actual animated rendering (appear/disappear, blur, motion, speed) lands with
// the scene-graph/block layer — these definitions already carry that intent.

export interface Template {
  id: string;
  name: string;
  durationSec: number;
  color: string; // segment block tint on the timeline
}

import { INFOGRAPHIC_TEMPLATES } from "./templates-infographic";

export const TEMPLATES: Template[] = [
  { id: "women-in-tech", name: "Women in Tech", durationSec: 8, color: "#ae33ff" },
  { id: "card-fade", name: "Card Fade", durationSec: 6, color: "#ff3f6c" },
  ...INFOGRAPHIC_TEMPLATES,
];

export interface Segment {
  id: string;
  templateId: string;
  name: string;
  startSec: number;
  durationSec: number;
  color: string;
  // Dropped placeholders start unsynced (free). "Sync" runs the AI pass that fits the
  // template to the video — that's the credit-consuming step (uses the user's API key).
  synced: boolean;
}

// A segment positioned on the expanded (edited) timeline.
export interface TimelineSeg extends Segment {
  insertFrame: number;
  durFrames: number;
  expandedStartSec: number;
}

// A section opening at its original promo frame and its position on the expanded timeline.
export interface DividerMark {
  originalFrame: number;
  expandedFrame: number;
}
