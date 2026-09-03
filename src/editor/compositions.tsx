import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { CameraMotionBlur } from "@remotion/motion-blur";
import { MyComposition } from "../Composition";
import { MyCompositionVertical } from "../CompositionVertical";
import { SfxLayer } from "../Sfx";
import { type ManualProps, cssFilterString, cssTransformString } from "./manualProps";

export type { ManualProps, BlurProps } from "./manualProps";

const Blur: React.FC<ManualProps["motionBlur"] & { children: React.ReactNode }> = ({ motionBlur, shutterAngle, samples, children }) =>
  motionBlur ? <CameraMotionBlur shutterAngle={shutterAngle} samples={samples}>{children}</CameraMotionBlur> : <>{children}</>;

const EffectsWrapper: React.FC<ManualProps & { children: React.ReactNode }> = (p) => {
  const filter = cssFilterString(p.colorGrade);
  const transform = cssTransformString(p.transform);
  const hasEffects = filter !== "none" || transform !== "none";
  return (
    <>
      <AbsoluteFill style={hasEffects ? { filter: filter === "none" ? undefined : filter, transform: transform === "none" ? undefined : transform, transformOrigin: "center center" } : undefined}>
        <Blur {...p.motionBlur}>{p.children}</Blur>
      </AbsoluteFill>
      {p.overlays.vignetteStrength > 0 && <AbsoluteFill style={{ background: `radial-gradient(ellipse ${Math.round(p.overlays.vignetteRadius * 180)}% ${Math.round(p.overlays.vignetteRadius * 180)}% at 50% 50%, transparent 50%, rgba(0,0,0,${p.overlays.vignetteStrength}) 100%)`, pointerEvents: "none" }} />}
      {p.colorGrade.tintOpacity > 0 && <AbsoluteFill style={{ background: p.colorGrade.tintColor, opacity: p.colorGrade.tintOpacity, mixBlendMode: "multiply", pointerEvents: "none" }} />}
    </>
  );
};

export const PromoLandscape: React.FC<ManualProps> = (p) => <><EffectsWrapper {...p}><MyComposition /></EffectsWrapper><SfxLayer audio={p.audio} /></>;
export const PromoVertical: React.FC<ManualProps> = (p) => <><EffectsWrapper {...p}><MyCompositionVertical /></EffectsWrapper><SfxLayer audio={p.audio} /></>;
export const PromoUltrawide: React.FC<ManualProps> = (p) => {
  const frame = useCurrentFrame();
  const topOffset = interpolate(frame, [140, 161], [-180, -60], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <><EffectsWrapper {...p}><AbsoluteFill style={{ overflow: "hidden" }}><div style={{ position: "absolute", top: topOffset, left: 0, width: 1280, height: 720, transform: "scale(2)", transformOrigin: "top left" }}><MyComposition ultrawide /></div></AbsoluteFill></EffectsWrapper><SfxLayer audio={p.audio} /></>;
};

export interface CompMeta {
  id: string;
  label: string;
  aspect: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  component: React.FC<ManualProps>;
}

export const COMPOSITIONS: CompMeta[] = [
  { id: "MyComp", label: "MynnovAIte Promo", aspect: "16:9", width: 1280, height: 720, fps: 30, durationInFrames: 1060, component: PromoLandscape },
  { id: "MyCompVertical", label: "MynnovAIte Promo · Vertical", aspect: "9:16", width: 1080, height: 1920, fps: 30, durationInFrames: 1060, component: PromoVertical },
  { id: "MyCompUltrawide", label: "MynnovAIte Promo · Ultrawide", aspect: "21:9", width: 2560, height: 1080, fps: 30, durationInFrames: 1060, component: PromoUltrawide },
];

export const ASPECT_GROUPS: string[][] = [["MyComp", "MyCompUltrawide", "MyCompVertical"]];

export function aspectOptionsFor(compId: string): { aspect: string; compId: string }[] {
  const group = ASPECT_GROUPS.find((g) => g.includes(compId)) ?? [compId];
  return group.map((id) => {
    const c = COMPOSITIONS.find((x) => x.id === id);
    return c ? { aspect: c.aspect, compId: c.id } : null;
  }).filter((x): x is { aspect: string; compId: string } => x !== null);
}
