"use client";

import React from "react";

// ─────────────────────────────────────────────────────────────────────────────
// ShinyButton — WHITE-THEME, frame-driven adaptation of the "shiny CTA" button.
//
// The original ships as a Next.js `<style jsx>` block using CSS @property +
// @keyframes (gradient-angle, shimmer, breathe). Those animate off the wall clock,
// which FREEZES in Remotion's headless frame-by-frame render — so here every moving
// part is recomputed each frame from `frame` instead of CSS animation.
//
// Colour inversion (black theme → white theme):
//   bg #000 → #fff · fg #fff → dark · highlight `blue` → light blue · subtle blues.
//
// Driven props:
//   frame  — master clock (continuous shine + shimmer + breathe)
//   hover  — 0‥1 hover buildup (border shine widens & turns bluer, glow blooms)
//   press  — 0‥1 click impact (shine flare + glow burst + centre flash)
// ─────────────────────────────────────────────────────────────────────────────

interface ShinyButtonProps {
  frame: number;
  hover?: number;
  press?: number;
  radius?: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

// white-theme palette — purple shine (was: #000 bg, white fg, `blue` highlight)
const HL = "#B66BFF"; // light-purple highlight
const SHINE_REST = "#D4B0FF"; // resting shine band (visible on a white face)
const SHINE_HOVER = "#ECDBFF"; // brighter shine on hover
const FACE = "#FFFFFF";
const RING = "#ECE7F6"; // subtle purple-tinted inset ring

export const ShinyButton: React.FC<ShinyButtonProps> = ({
  frame,
  hover = 0,
  press = 0,
  radius = 20,
  children,
  style,
}) => {
  const energy = Math.max(hover, press); // combined "liveliness"

  // gradient-percent 5%→20% on hover, with a wider flare on click
  const pct = 5 + 15 * hover + 22 * press;
  // gradient-angle-offset 0→95deg on hover (shifts where the shine sits)
  const offset = 95 * hover;
  const shine = hover > 0.02 || press > 0.02 ? SHINE_HOVER : SHINE_REST;

  // continuous rotations (deg) — were the gradient-angle / shimmer keyframes
  const gAngle = (frame * 2) % 360;
  const shimmerAngle = (frame * 3) % 360;
  // breathing glow scale — was the `breathe` keyframe
  const breathe = 1 + Math.sin(frame * 0.05) * 0.08;

  // conic-gradient border via the padding-box / border-box technique
  const borderBg =
    `linear-gradient(${FACE}, ${FACE}) padding-box, ` +
    `conic-gradient(from ${gAngle - offset}deg, ` +
    `transparent, ${HL} ${pct}%, ${shine} ${pct * 2}%, ` +
    `${HL} ${pct * 3}%, transparent ${pct * 4}%) border-box`;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        borderRadius: radius,
        border: "2.5px solid transparent",
        background: borderBg,
        // inset ring + soft lift + light-blue bloom that grows with hover / click
        boxShadow:
          `inset 0 0 0 1px ${RING}, ` +
          `0 14px 34px -8px rgba(40,40,80,0.34), ` +
          `0 0 ${24 + 64 * energy}px rgba(174,51,255,${0.24 + 0.5 * energy})`,
        overflow: "hidden",
        ...style,
      }}
    >
      {/* dots texture — subtle blue-grey grid, masked by a rotating conic wedge */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: radius,
          background:
            "radial-gradient(circle at 2px 2px, rgba(150,90,210,0.5) 0.5px, transparent 0)",
          backgroundSize: "4px 4px",
          WebkitMaskImage: `conic-gradient(from ${gAngle + 45}deg, black, transparent 10% 90%, black)`,
          maskImage: `conic-gradient(from ${gAngle + 45}deg, black, transparent 10% 90%, black)`,
          opacity: 0.32,
          pointerEvents: "none",
        }}
      />

      {/* inner shimmer — rotating light-blue sweep masked toward the bottom */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: "150%",
          aspectRatio: "1",
          transform: `translate(-50%, -50%) rotate(${shimmerAngle}deg)`,
          background: `linear-gradient(-50deg, transparent, ${HL}, transparent)`,
          WebkitMaskImage: "radial-gradient(circle at bottom, transparent 40%, black)",
          maskImage: "radial-gradient(circle at bottom, transparent 40%, black)",
          opacity: 0.3 + 0.35 * hover,
          pointerEvents: "none",
        }}
      />

      {/* breathe glow — bottom inner bloom; appears on hover, flares on click */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: radius,
          boxShadow: `inset 0 -1.1rem 1.9rem 2px ${HL}`,
          opacity: Math.min(1, hover * 0.7 + press),
          transform: `scale(${breathe})`,
          pointerEvents: "none",
        }}
      />

      {/* click flash — quick centre bloom so the press "lands" */}
      {press > 0.01 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: radius,
            background:
              "radial-gradient(circle at 50% 50%, rgba(205,150,255,0.9), transparent 65%)",
            opacity: press * 0.55,
            pointerEvents: "none",
          }}
        />
      )}

      {children}
    </div>
  );
};
