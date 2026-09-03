"use client";

import { useCurrentFrame } from "remotion";
import { GrainGradient } from "@paper-design/shaders-react";

// Animated grain-gradient backdrop — dark / brand palette.
//
// Remotion note: the shader normally animates off its own requestAnimationFrame
// clock, which freezes in a headless frame-by-frame render. So we set `speed={0}`
// to disable that clock and drive `frame` from Remotion's useCurrentFrame() — the
// shader's u_time then advances deterministically and renders correctly in export.
export function GradientBackground() {
  const frame = useCurrentFrame();
  // Blob positions use frequencies that complete whole cycles in exactly 1060 frames
  // so the animation loops seamlessly: state at f=1059 → f=0 is a smooth jump.
  //   offsetX: 2 full cycles (sin completes at 4π = frame 1060)
  //   offsetY: 1 full cycle  (cos completes at 2π = frame 1060)
  const T = 1060;
  const offsetX = Math.sin((frame / T) * Math.PI * 4) * 0.46;
  const offsetY = Math.cos((frame / T) * Math.PI * 2) * 0.4;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
      <GrainGradient
        style={{ height: "100%", width: "100%" }}
        colorBack="hsl(252, 55%, 3%)"
        softness={0.86}
        intensity={0.24}
        noise={0}
        shape="corners"
        offsetX={offsetX}
        offsetY={offsetY}
        scale={1.35}
        rotation={0}
        speed={0}
        frame={frame * 2.6}
        colors={["hsl(350, 88%, 28%)", "hsl(276, 80%, 30%)", "hsl(255, 70%, 13%)"]}
      />
      {/* dark veil — grounds it to a true dark-theme backdrop & lifts text contrast */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
    </div>
  );
}
