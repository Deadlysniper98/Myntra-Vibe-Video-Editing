import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { MyComposition } from "../Composition";
import { MyCompositionVertical } from "../CompositionVertical";
import { TEMPLATE_COMPONENTS } from "./templates-render";

export interface ComposedSeg {
  id: string;
  templateId: string;
  insertFrame: number; // original promo frame the section is inserted at
  durFrames: number;
}

export interface ComposedPromoProps {
  compId: string;
  composed: ComposedSeg[];
  baseDurationInFrames: number;
}

// Builds a real edited timeline: promo content, then an inserted template section, then
// the promo CONTINUES from where it left off (true insertion, not an overlay). Each promo
// block is clipped to its window and frame-remapped via a nested negative-`from` Sequence,
// so the part after an insert resumes at the right frame. (No SFX here — the audio layer
// can't be split cleanly yet; the plain preview keeps SFX when nothing is inserted.)
export const ComposedPromo: React.FC<ComposedPromoProps> = ({
  compId,
  composed,
  baseDurationInFrames,
}) => {
  const Base = compId === "MyCompVertical" ? MyCompositionVertical : MyComposition;
  const blocks: React.ReactNode[] = [];
  let promoCursor = 0;
  let tlCursor = 0;

  const pushPromo = (promoStart: number, len: number, key: string) => {
    if (len <= 0) return;
    blocks.push(
      <Sequence key={key} from={tlCursor} durationInFrames={len}>
        {/* negative offset → Base plays frames [promoStart, promoStart+len) in this window */}
        <Sequence from={-promoStart}>
          <Base />
        </Sequence>
      </Sequence>,
    );
    tlCursor += len;
  };

  const sorted = [...composed].sort((a, b) => a.insertFrame - b.insertFrame);
  for (const seg of sorted) {
    pushPromo(promoCursor, seg.insertFrame - promoCursor, `p-${seg.id}`);
    const Tpl = TEMPLATE_COMPONENTS[seg.templateId];
    if (Tpl) {
      blocks.push(
        <Sequence key={`t-${seg.id}`} from={tlCursor} durationInFrames={seg.durFrames}>
          <Tpl />
        </Sequence>,
      );
      tlCursor += seg.durFrames;
    }
    promoCursor = seg.insertFrame;
  }
  pushPromo(promoCursor, baseDurationInFrames - promoCursor, "p-final");

  return <AbsoluteFill style={{ background: "#000" }}>{blocks}</AbsoluteFill>;
};
