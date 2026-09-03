import "./index.css";
import React from "react";
import { Composition } from "remotion";
import { z } from "zod";
import { DEFAULT_MANUAL_PROPS, type ManualProps } from "./editor/manualProps";
import { PromoLandscape, PromoVertical, PromoUltrawide } from "./editor/compositions";

export const myCompSchema = z.object({
  motionBlur: z.object({ motionBlur: z.boolean(), shutterAngle: z.number().min(0).max(360), samples: z.number().int().min(2).max(32) }),
  colorGrade: z.object({ brightness: z.number().min(0).max(3), contrast: z.number().min(0).max(3), saturation: z.number().min(0).max(3), hueRotate: z.number().min(-360).max(360), temperature: z.number().min(-100).max(100), tintColor: z.string(), tintOpacity: z.number().min(0).max(1) }),
  overlays: z.object({ vignetteStrength: z.number().min(0).max(1), vignetteRadius: z.number().min(0.3).max(1), glowStrength: z.number().min(0).max(1), glowRadius: z.number().min(0).max(50), grainAmount: z.number().min(0).max(1) }),
  transform: z.object({ scaleX: z.number().min(0.1).max(3), scaleY: z.number().min(0.1).max(3), offsetX: z.number().min(-50).max(50), offsetY: z.number().min(-50).max(50), rotation: z.number().min(-180).max(180) }),
  easing: z.object({ preset: z.enum(["SWIFT", "POP", "DRIFT", "PUSH_IN", "FAST_OUT", "CUSTOM"]), p1x: z.number(), p1y: z.number(), p2x: z.number(), p2y: z.number() }),
  audio: z.object({ masterVolume: z.number().min(0).max(1), sfxVolume: z.number().min(0).max(1), musicVolume: z.number().min(0).max(1) }),
  speed: z.object({ multiplier: z.number().min(0.25).max(4) }),
  chromaKey: z.object({ enabled: z.boolean(), keyColor: z.string(), threshold: z.number().min(0).max(1), feather: z.number().min(0).max(20), spillSuppress: z.number().min(0).max(1) }),
  fps: z.number().optional(),
});

type SchemaProps = z.infer<typeof myCompSchema>;
const Landscape: React.FC<SchemaProps> = (props) => <PromoLandscape {...(props as ManualProps)} />;
const Vertical: React.FC<SchemaProps> = (props) => <PromoVertical {...(props as ManualProps)} />;
const Ultrawide: React.FC<SchemaProps> = (props) => <PromoUltrawide {...(props as ManualProps)} />;

const shared = { schema: myCompSchema, defaultProps: { ...DEFAULT_MANUAL_PROPS }, calculateMetadata: ({ props }: { props: SchemaProps }) => ({ fps: props.fps ?? 30 }), durationInFrames: 1060, fps: 30 };

export const RemotionRoot: React.FC = () => <>
  <Composition id="MyComp" component={Landscape} {...shared} width={1280} height={720} />
  <Composition id="MyCompVertical" component={Vertical} {...shared} width={1080} height={1920} />
  <Composition id="MyCompUltrawide" component={Ultrawide} {...shared} width={2560} height={1080} />
</>;

