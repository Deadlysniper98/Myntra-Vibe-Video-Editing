// Types, defaults, and helpers for the Manual Mode property surface.
// No remotion imports — this runs in both the editor UI and the Remotion player.

export type ManualProps = {
  motionBlur: {
    motionBlur: boolean;
    shutterAngle: number; // 0–360°
    samples: number;      // 2–32
  };
  colorGrade: {
    brightness: number;  // 0–3, default 1
    contrast: number;    // 0–3, default 1
    saturation: number;  // 0–3, default 1
    hueRotate: number;   // -360–360°, default 0
    temperature: number; // -100 to +100 (warm/cool tint)
    tintColor: string;   // hex color for tint overlay
    tintOpacity: number; // 0–1
  };
  overlays: {
    vignetteStrength: number; // 0–1
    vignetteRadius: number;   // 0.3–1.0 (how far the vignette reaches)
    glowStrength: number;     // 0–1 (Phase 2)
    glowRadius: number;       // 0–50px (Phase 2)
    grainAmount: number;      // 0–1 (Phase 2)
  };
  transform: {
    scaleX: number;   // 0.1–3
    scaleY: number;   // 0.1–3
    offsetX: number;  // -50 to +50 %
    offsetY: number;  // -50 to +50 %
    rotation: number; // -180 to +180°
  };
  easing: {
    preset: "SWIFT" | "POP" | "DRIFT" | "PUSH_IN" | "FAST_OUT" | "CUSTOM";
    p1x: number; p1y: number; // cubic-bezier P1 (custom mode)
    p2x: number; p2y: number; // cubic-bezier P2 (custom mode)
  };
  audio: {
    masterVolume: number; // 0–1
    sfxVolume: number;    // 0–1
    musicVolume: number;  // 0–1
  };
  speed: {
    multiplier: number; // 0.25–4
  };
  chromaKey: {
    enabled: boolean;
    keyColor: string;      // hex color to remove
    threshold: number;     // 0–1
    feather: number;       // 0–20px edge softness
    spillSuppress: number; // 0–1
  };
};

// BlurProps = motionBlur sub-object (backward compat for RenderDialog / render.ts)
export type BlurProps = ManualProps["motionBlur"];

export const DEFAULT_MANUAL_PROPS: ManualProps = {
  motionBlur: { motionBlur: true, shutterAngle: 360, samples: 2 },
  colorGrade: {
    brightness: 1,
    contrast: 1,
    saturation: 1,
    hueRotate: 0,
    temperature: 0,
    tintColor: "#6600ff",
    tintOpacity: 0,
  },
  overlays: {
    vignetteStrength: 0,
    vignetteRadius: 0.7,
    glowStrength: 0,
    glowRadius: 20,
    grainAmount: 0,
  },
  transform: { scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0, rotation: 0 },
  easing: { preset: "DRIFT", p1x: 0.22, p1y: 1, p2x: 0.36, p2y: 1 },
  audio: { masterVolume: 1, sfxVolume: 1, musicVolume: 1 },
  speed: { multiplier: 1 },
  chromaKey: { enabled: false, keyColor: "#00ff00", threshold: 0.3, feather: 2, spillSuppress: 0.5 },
};

// Build a CSS `filter` string from the colorGrade sub-object.
export function cssFilterString(c: ManualProps["colorGrade"]): string {
  const parts: string[] = [];
  if (c.brightness !== 1) parts.push(`brightness(${c.brightness.toFixed(3)})`);
  if (c.contrast !== 1) parts.push(`contrast(${c.contrast.toFixed(3)})`);
  if (c.saturation !== 1) parts.push(`saturate(${c.saturation.toFixed(3)})`);
  if (c.hueRotate !== 0) parts.push(`hue-rotate(${c.hueRotate}deg)`);
  if (c.temperature !== 0) {
    const t = c.temperature / 100;
    if (t > 0) parts.push(`sepia(${(t * 0.4).toFixed(3)})`);
    else parts.push(`hue-rotate(${(t * -20).toFixed(1)}deg)`);
  }
  return parts.join(" ") || "none";
}

// Build a CSS `transform` string from the transform sub-object.
export function cssTransformString(t: ManualProps["transform"]): string {
  const parts: string[] = [];
  if (t.offsetX !== 0 || t.offsetY !== 0)
    parts.push(`translate(${t.offsetX}%, ${t.offsetY}%)`);
  if (t.scaleX !== 1 || t.scaleY !== 1)
    parts.push(`scale(${t.scaleX}, ${t.scaleY})`);
  if (t.rotation !== 0) parts.push(`rotate(${t.rotation}deg)`);
  return parts.join(" ") || "none";
}

// Compact human-readable block prepended to AI prompts so the model sees current state.
export function serializeManualProps(m: ManualProps): string {
  const lines: string[] = ["[Manual State]"];
  const mb = m.motionBlur;
  const cg = m.colorGrade;
  const ov = m.overlays;
  const tr = m.transform;
  const au = m.audio;

  lines.push(
    `motionBlur: ${mb.motionBlur ? "ON" : "OFF"} · shutterAngle=${mb.shutterAngle}° · samples=${mb.samples}`,
  );

  const cgChanged =
    cg.brightness !== 1 || cg.contrast !== 1 || cg.saturation !== 1 ||
    cg.hueRotate !== 0 || cg.temperature !== 0 || cg.tintOpacity > 0;
  if (cgChanged) {
    lines.push(
      `colorGrade: brightness=${cg.brightness}, contrast=${cg.contrast}, saturation=${cg.saturation}, hue=${cg.hueRotate}°, temp=${cg.temperature}`,
    );
    if (cg.tintOpacity > 0)
      lines.push(`tint: ${cg.tintColor} @ ${Math.round(cg.tintOpacity * 100)}%`);
  }

  if (ov.vignetteStrength > 0 || ov.glowStrength > 0 || ov.grainAmount > 0) {
    lines.push(
      `overlays: vignette=${ov.vignetteStrength}, glow=${ov.glowStrength}, grain=${ov.grainAmount}`,
    );
  }

  const trChanged =
    tr.scaleX !== 1 || tr.scaleY !== 1 || tr.offsetX !== 0 || tr.offsetY !== 0 || tr.rotation !== 0;
  if (trChanged) {
    lines.push(
      `transform: scale=(${tr.scaleX},${tr.scaleY}), offset=(${tr.offsetX}%,${tr.offsetY}%), rotation=${tr.rotation}°`,
    );
  }

  lines.push(`easing: ${m.easing.preset}`);

  if (au.masterVolume !== 1 || au.sfxVolume !== 1 || au.musicVolume !== 1) {
    lines.push(`audio: master=${au.masterVolume}, sfx=${au.sfxVolume}, music=${au.musicVolume}`);
  }
  if (m.speed.multiplier !== 1) lines.push(`speed: ${m.speed.multiplier}×`);
  if (m.chromaKey.enabled) {
    lines.push(
      `chromaKey: ON · color=${m.chromaKey.keyColor}, threshold=${m.chromaKey.threshold}`,
    );
  }

  return lines.join("\n");
}

// Deep clone — prevents shared sub-object references across snapshot captures.
export function deepCloneManual(m: ManualProps): ManualProps {
  return JSON.parse(JSON.stringify(m)) as ManualProps;
}
