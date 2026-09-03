import React from "react";
import { GradientBackground } from "./components/ui/paper-design-shader-background";
import { ShinyButton } from "./components/ui/shiny-button";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  AbsoluteFill,
  Img,
  staticFile,
} from "remotion";
import {
  PUSH_IN,
  popIn,
  fadeScaleIn,
  fadeScaleOut,
  DRIFT,
} from "./motion";

// ─── Brand easing — the smooth decel is the spec's §3 Case B entry curve
//     (cubic-bezier(0.16,1,0.3,1)), shared from ./motion as the single source. ─
const EO = PUSH_IN;
const EI = Easing.in(Easing.quad);

// ─── Brand design tokens ──────────────────────────────────────────────────────
export const T = {
  paper: "#080612", // --paper
  paper2: "#0F0E1C", // --paper-2
  paper3: "#171528", // --paper-3
  accent: "#FF3F6C", // --accent  (Myntra pink-red)
  purple: "#AE33FF", // brand purple
  mute1: "#C8C6E8", // --mute-1
  mute2: "#B0AECE", // --mute-2
  mute3: "#9896C2", // --mute-3
  mute4: "#6A6890", // --mute-4
  line: "rgba(255,255,255,0.05)",
  line2: "rgba(255,255,255,0.09)",
  line3: "rgba(255,255,255,0.15)",
  font: "'Inter Tight', -apple-system, sans-serif",
  head: "'Outfit', 'Inter Tight', sans-serif", // clean, open font for medium headings & names
  // Dominant, all-caps editorial display face for the big scene headings (tall/condensed).
  display: "'Bebas Neue', 'Outfit', sans-serif",
  grad: "linear-gradient(95deg, #FF3F6C, #AE33FF)", // primary gradient
  gradLong: "linear-gradient(95deg, #FF3F6C 0%, #AE33FF 50%, #F59E0B 100%)",
};

// ─── Assets ──────────────────────────────────────────────────────────────────
const BASE = "https://dasmeshverma1-wq.github.io/New-Hackerramp";
export const LOGO_URL = `${BASE}/images/Frame%20632872.svg`;
export const TROPHY_1_URL = staticFile("trophies/trophy-1st.png");
export const TROPHY_2_URL = staticFile("trophies/trophy-2nd.png");
export const TROPHY_3_URL = staticFile("trophies/trophy-3rd.png");
export const LOGO_W = 480;
export const LOGO_H = Math.round(LOGO_W * (158 / 878));

// ─── Background particles ────────────────────────────────────────────────────
export const SUBTLE_PX = [
  { x: 7, y: 14, r: 2, c: T.accent, sp: 0.031 },
  { x: 22, y: 72, r: 1.5, c: T.purple, sp: 0.042 },
  { x: 38, y: 30, r: 1, c: T.accent, sp: 0.037 },
  { x: 55, y: 85, r: 2, c: T.purple, sp: 0.028 },
  { x: 70, y: 22, r: 1.5, c: T.accent, sp: 0.044 },
  { x: 82, y: 60, r: 1, c: T.purple, sp: 0.033 },
  { x: 14, y: 50, r: 1.5, c: T.accent, sp: 0.039 },
  { x: 62, y: 45, r: 2, c: T.purple, sp: 0.026 },
  { x: 90, y: 80, r: 1, c: T.accent, sp: 0.048 },
  { x: 46, y: 10, r: 1.5, c: T.purple, sp: 0.035 },
];

// ─── Scene 3 – How It Works (3-step connected stepper, dark theme) ───────────
export const STEPS = [
  { title: "Propose an Idea", glow: "174,51,255" }, // purple
  { title: "Build Your Team", glow: "255,63,108" }, // pink
  { title: "Ship It", glow: "200,90,255" }, // light purple
];

// White line icons (one per step) read clean on the dark glass tiles.
export const StepIcon: React.FC<{ i: number }> = ({ i }) => {
  const p = {
    fill: "none",
    stroke: "#fff",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <svg width={58} height={58} viewBox="0 0 24 24">
      {i === 0 && (
        <g {...p}>
          <path d="M9 18h6M10 21h4" />
          <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5.9 1 .95 1.7h5.3c.05-.7.35-1.2.95-1.7A6 6 0 0 0 12 3z" />
        </g>
      )}
      {i === 1 && (
        <g {...p}>
          <path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="3.4" />
          <path d="M22 20v-2a4 4 0 0 0-3-3.85M16.5 3.65a4 4 0 0 1 0 7" />
        </g>
      )}
      {i === 2 && (
        // upright rocket — symmetric body, symmetric swept wings, centred flame
        <g {...p}>
          {/* body + nose cone */}
          <path d="M12 2.5c2.7 2.6 3.9 5.9 3.9 8.8 0 2-.6 3.4-1.5 4.4H9.6c-.9-1-1.5-2.4-1.5-4.4 0-2.9 1.2-6.2 3.9-8.8z" />
          {/* window */}
          <circle cx="12" cy="9.3" r="1.7" />
          {/* left wing */}
          <path d="M8.1 13.1c-2 .9-3.1 2.8-3 5.1 1.8-.4 3.1-1.4 3.4-3" />
          {/* right wing */}
          <path d="M15.9 13.1c2 .9 3.1 2.8 3 5.1-1.8-.4-3.1-1.4-3.4-3" />
          {/* exhaust flame */}
          <path d="M10.6 16.2 12 19.5l1.4-3.3" />
        </g>
      )}
    </svg>
  );
};

// ─── Scene 3.5 – Build Your Team (landscape adaptation of the TeamBuild comp) ─
// Five glossy characters rise into a group; first two = "a team of 2", then three
// more fill in for "up to 5 members". Positions spread outward across 1280×720.
// Leader (ta, centre, first to arrive) is the darkest purple; the rest are medium purple.
// Five real (faceless mannequin) team figures, clustered like a group photo: centre
// hero forward + largest, two flanking, two outer. Sized so most of the body (down to
// the shins) shows, with each head held at a steady height. Only the first two arrive
// during the "team of 2" caption; the other three join on "up to 5 members".
const TEAM_IMGS: {
  id: string;
  src: string;
  x: number; // horizontal centre (px)
  w: number; // width (px)
  bottom: number; // negative → overhangs/cut below the frame
  z: number;
  appear: number;
  phase: number;
  bob: number;
  sway: number;
}[] = [
  { id: "center", src: "team/team-2.png", x: 640, w: 384, bottom: -95, z: 5, appear: 8, phase: 0.0, bob: 9, sway: 4 },
  { id: "left", src: "team/team-5.png", x: 446, w: 344, bottom: -60, z: 3, appear: 46, phase: 1.1, bob: 8, sway: 4 },
  { id: "right", src: "team/team-1.png", x: 834, w: 344, bottom: -60, z: 4, appear: 158, phase: 2.0, bob: 8, sway: 4 },
  { id: "fleft", src: "team/team-3.png", x: 268, w: 312, bottom: -40, z: 4, appear: 180, phase: 0.6, bob: 7, sway: 3 },
  { id: "fright", src: "team/team-4.png", x: 1012, w: 312, bottom: -40, z: 3, appear: 202, phase: 2.7, bob: 7, sway: 3 },
];

const TeamFigure: React.FC<{
  p: (typeof TEAM_IMGS)[number];
  tf: number;
  fps: number;
}> = ({ p, tf, fps }) => {
  const ent = fadeScaleIn(tf, p.appear, fps, 600); // settle from foreground
  const rise = interpolate(tf, [p.appear, p.appear + 30], [260, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: DRIFT,
  });
  const since = Math.max(0, tf - (p.appear + 16));
  const bob = Math.sin(since * 0.05 + p.phase) * p.bob;
  const sway = Math.sin(since * 0.035 + p.phase * 1.3) * p.sway;
  return (
    <div
      style={{
        position: "absolute",
        left: p.x,
        bottom: p.bottom,
        width: p.w,
        transform: `translate(calc(-50% + ${sway}px), ${rise + bob}px) scale(${ent.scale})`,
        transformOrigin: "bottom center",
        opacity: ent.opacity,
        zIndex: p.z,
        filter: "drop-shadow(0 22px 44px rgba(0,0,0,0.6))",
      }}
    >
      <Img src={staticFile(p.src)} style={{ width: "100%", height: "auto", display: "block" }} />
    </div>
  );
};

// ─── Scene 4 – Idea Bazaar ────────────────────────────────────────────────────
// index 4 = Dasmesh Verma — centre card of the middle column (middle of 9).
export const IDEAS = [
  { id: "01", text: "Smart sizing from body measurements and purchase history — fewer returns, happier customers.", name: "Alok Kumar",        avatar: "team/team-2.png" },
  { id: "02", text: "Upload any photo and instantly surface visually similar items, powered by multimodal AI.", name: "Shiva Tiwari",       avatar: "team/team-5.png" },
  { id: "03", text: "AI-generated outfits that blend your existing wardrobe with fresh Myntra picks.",          name: "Rohan Gore",         avatar: "team/team-1.png" },
  { id: "04", text: "Real-time warehouse heatmaps that route pickers along the shortest possible path.",        name: "Arun Nair",          avatar: "team/team-4.png" },
  { id: "05", text: "Time-limited exclusive drops for loyal customers — urgency that actually rewards.",        name: "Dasmesh Verma",      avatar: "team/team-5.png" },
  { id: "06", text: "A fully automated return — pickup scheduled, label printed, courier sent, zero clicks.",   name: "Anuhya Akkireddi",   avatar: "team/team-2.png" },
  { id: "07", text: "Gift wishlists with AI-curated suggestions for friends and family.",                       name: "Vaibhav Singh",      avatar: "team/team-5.png" },
  { id: "08", text: "Chat-first shopping: describe what you want in plain words, get a curated rail back.",     name: "Akshatha K Shetty", avatar: "team/team-4.png" },
  { id: "09", text: "ML sorting that predicts the optimal bin placement for faster same-day dispatch.",         name: "Banasmita Das",      avatar: "team/team-1.png" },
];

// ─── Scene 5 – Podium (2nd left · 1st centre · 3rd right) ───────────────────
export const PODIUM_CARDS = [
  {
    rank: "2ND PLACE",
    event: "Grand prize",
    prize: "₹1,00,000",
    category: "Swag · Recognition",
    borderColor: "rgba(200,200,200,0.16)",
    rankColor: "#B0AECE",
    glowRgb: "180,180,180",
    medalUrl: TROPHY_2_URL,
    delay: 22,
    lift: -6,
  },
  {
    rank: "1ST PLACE",
    event: "Grand prize",
    prize: "₹1,50,000",
    category: "Mentorship · Production Support",
    borderColor: "rgba(245,158,11,0.55)",
    rankColor: "#F59E0B",
    glowRgb: "245,158,11",
    medalUrl: TROPHY_1_URL,
    delay: 0,
    lift: -42,
  },
  {
    rank: "3RD PLACE",
    event: "Grand prize",
    prize: "₹75,000",
    category: "Design Excellence Badge",
    borderColor: "rgba(205,127,50,0.32)",
    rankColor: "#CD7F32",
    glowRgb: "205,127,50",
    medalUrl: TROPHY_3_URL,
    delay: 44,
    lift: 16,
  },
];

// ─── Scene S_SPEAKERS – speaker roster (coverflow carousel) ──────────────────
export const SPEAKERS = [
  {
    name: "Nitesh Jain",
    role: "Senior Principal Engineer",
    company: "Razorpay",
    img: staticFile("speakers/nitesh-jain.jpeg"),
    logo: staticFile("speakers/logo-razorpay.png"),
  },
  {
    name: "Shamik Sharma",
    role: "Head of Product (SVP)",
    company: "Atlassian",
    img: staticFile("speakers/shamik-sharma.jpeg"),
    logo: staticFile("speakers/logo-atlassian.png"),
  },
  {
    name: "Pratyush Kumar",
    role: "Co-Founder",
    company: "Sarvam AI",
    img: staticFile("speakers/pratyush-kumar.jpeg"),
    logo: staticFile("speakers/logo-sarvam.png"),
  },
];

// ─── Scene S_WIT – Women in Tech (orbital "Speakers Circle") ─────────────────
// Mock placeholder avatars (no real photos) orbit on concentric rings while
// decorative bokeh drifts — an auto-playing version of the site's scroll-reveal.
export const AV_TINTS: Record<string, { hi: string; lo: string; glow: string }> = {
  pink: { hi: "#ff8fbe", lo: "#c52d68", glow: "rgba(255,45,120,0.55)" },
  purple: { hi: "#cda6ff", lo: "#7a2adf", glow: "rgba(176,50,255,0.55)" },
  violet: { hi: "#a797ff", lo: "#5a36c8", glow: "rgba(120,90,240,0.50)" },
  rose: { hi: "#ffaecf", lo: "#d23a73", glow: "rgba(255,95,160,0.50)" },
  indigo: { hi: "#9aa4ff", lo: "#4044c4", glow: "rgba(90,100,240,0.50)" },
  steel: { hi: "#c6d0ee", lo: "#5a6694", glow: "rgba(150,160,200,0.45)" },
};

// styled female mannequin placeholders (faceless, fashion outfits) — 9 variants
export const WIT_FEMALES = [
  staticFile("speakers/wit-1.jpeg"),
  staticFile("speakers/wit-2.jpeg"),
  staticFile("speakers/wit-3.jpeg"),
  staticFile("speakers/wit-4.jpeg"),
  staticFile("speakers/wit-5.jpeg"),
  staticFile("speakers/wit-6.jpeg"),
  staticFile("speakers/wit-7.jpeg"),
  staticFile("speakers/wit-8.jpeg"),
  staticFile("speakers/wit-9.jpeg"),
];
const AV_TINT_CYCLE: (keyof typeof AV_TINTS)[] = [
  "rose",
  "pink",
  "violet",
  "purple",
  "indigo",
];

export const MockAvatar: React.FC<{
  size: number;
  img: string;
  tint: keyof typeof AV_TINTS;
}> = ({ size, img, tint }) => {
  const c = AV_TINTS[tint];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        border: "2px solid rgba(255,255,255,0.22)",
        boxShadow: `0 10px 26px rgba(0,0,0,0.5), 0 0 ${size * 0.4}px ${c.glow}`,
      }}
    >
      <Img
        src={img}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center top",
        }}
      />
    </div>
  );
};

// Concentric "shells" of the Leadership Circle. The 3 inner faces (shell 0) are the
// confirmed leaders, fully sharp. Each outer shell recedes — progressively blurred &
// faded — filling the canvas so the circle reads as a large community fanning outward.
export const WIT_SHELLS = [
  { r: 214, count: 3, blur: 0, fade: 1.0, off: -56, named: true },
  { r: 336, count: 3, blur: 1.8, fade: 0.78, off: 26, named: false },
  { r: 458, count: 4, blur: 4, fade: 0.54, off: 60, named: false },
  { r: 584, count: 4, blur: 7, fade: 0.38, off: 30, named: false },
  { r: 712, count: 4, blur: 10, fade: 0.24, off: 64, named: false },
];
export const WIT_LEADERS = [
  { name: "Sharon Pais", role: "Head, Myntra" },
  { name: "Vindhya", role: "Sr. Dir Engineering" },
  { name: "To be decided", role: "" },
];
type WitDot = {
  r: number;
  angle: number;
  blur: number;
  fade: number;
  shell: number;
  img: string;
  tint: keyof typeof AV_TINTS;
  name?: string;
  role?: string;
};
export const WIT_AVATAR_SIZE = 130; // every face is the same size; depth comes from blur/fade
export const WIT_DOTS: WitDot[] = (() => {
  const out: WitDot[] = [];
  let k = 0;
  WIT_SHELLS.forEach((s, si) => {
    for (let i = 0; i < s.count; i++) {
      const leader = s.named ? WIT_LEADERS[i] : undefined;
      out.push({
        r: s.r,
        angle: s.off + (360 / s.count) * i,
        blur: s.blur,
        fade: s.fade,
        shell: si,
        img: WIT_FEMALES[k % WIT_FEMALES.length],
        tint: AV_TINT_CYCLE[k % AV_TINT_CYCLE.length],
        name: leader?.name,
        role: leader?.role,
      });
      k++;
    }
  });
  return out;
})();

// ─── Wave helper — replicates site's waveFromSource keyframe ─────────────────
export const waveForProgress = (p: number) => ({
  scale: interpolate(p, [0, 0.1, 0.55, 0.8, 1.0], [1.0, 1.3, 2.0, 2.7, 3.2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }),
  opacity: interpolate(p, [0, 0.1, 0.55, 0.8, 1.0], [0, 0.88, 0.55, 0.16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }),
  blur: interpolate(p, [0, 0.1, 0.55, 0.8, 1.0], [0, 0, 1, 4, 9], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }),
});
export const WAVE_PERIOD = 240; // long, calm cycle (in 2× frame space) for a smooth, slow pulse

// ─────────────────────────────────────────────────────────────────────────────
export const MyComposition = ({ ultrawide = false }: { ultrawide?: boolean }) => {
  // 2× master clock — the whole timeline plays at double speed ("2× is the new 1×").
  // Every scene/keyframe below is expressed in this doubled frame space.
  const frame = useCurrentFrame() * 2;
  const { fps } = useVideoConfig();

  // ── Scene timeline (virtual 2× frames) — every start derived from the lengths ──
  const INTRO = 330; // "Got an idea?" → "Create a squad" button
  const S3 = INTRO; // How it works
  const S3_LEN = 264;
  const TEAM = S3 + S3_LEN; // Build your squad
  const TEAM_LEN = 280;
  const S4 = TEAM + TEAM_LEN; // Idea Bazaar
  const S4_LEN = 220;
  const S5 = S4 + S4_LEN; // Prizes
  const S5_LEN = 256; // longer hold so the prizes read (cards don't leave too early)
  const S_SPEAKERS = S5 + S5_LEN;            // Speakers & Mentors  (virtual 1350)
  const S_SPEAKERS_LEN = 330; // coverflow carousel: 3 holds + 2 slides
  const S_WIT = S_SPEAKERS + S_SPEAKERS_LEN; // Women in Tech       (virtual 1680)
  const S_WIT_LEN = 230; // orbital wave: ripple in → hold → ripple out
  const S6 = S_WIT + S_WIT_LEN; // CTA (total = S6 + 210 = 2120 → 1060 real frames)

  // ══════════════════════════════════════════════════════════════════════════
  // INTRO — "Got an idea?" morphs into a "Create a squad" button
  // ══════════════════════════════════════════════════════════════════════════
  // after the click the whole intro slides up & fades — handing momentum to How it works
  const introOut = interpolate(frame, [280, 322], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EI,
  });
  const introExitY = interpolate(frame, [280, 322], [0, -70], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EI,
  });
  const introGlowOp = interpolate(frame, [4, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EO,
  });
  // "Got [💡] an idea?" — each piece rises up from below AND slides a touch left into
  // its final centred spot, one by one (same fade-up feel as the closing CTA words).
  const introEnter = (delay: number) => ({
    op: interpolate(frame, [delay, delay + 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EO }),
    y: interpolate(frame, [delay, delay + 32], [46, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: DRIFT }),
    x: interpolate(frame, [delay, delay + 32], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: DRIFT }),
  });
  const enterGot = introEnter(8);
  const enterBulb = introEnter(24);
  const enterIdea = introEnter(40);
  // "Got [💡 square] an idea?" — a proper-sized bulb SQUARE button pops in between the
  // words, then the square WIDENS into the "Create a squad" rectangle while "Got"
  // slides left, "an idea?" slides right, and the emoji swaps up for the label.
  const bulbOp = enterBulb.op; // emoji fades in with the square's entrance
  // "an idea?" is wider than "Got", so the box is shifted LEFT of screen-centre to keep
  // the whole "Got [box] an idea?" GROUP centred; it slides to true centre as it morphs.
  const boxOffsetX = interpolate(frame, [98, 152], [-86, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EO,
  });
  // morph: the square (96) widens into the wide button (392); height stays 96
  const boxW = interpolate(frame, [98, 152], [96, 392], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EO,
  });
  const sideFade = interpolate(frame, [96, 132], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EI,
  });
  const sideShift = interpolate(frame, [96, 140], [0, 64], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EI,
  });
  // emoji rolls up & out the top, label rolls up from below (slot-reel swap)
  const emojiY = interpolate(frame, [104, 148], [0, -88], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EO,
  });
  const textY = interpolate(frame, [104, 148], [88, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EO,
  });
  const ctaTxtOp = interpolate(frame, [110, 146], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EO,
  });
  // cursor flies in from lower-left (tip leads), then tilts + presses on click (~268)
  const curOp = interpolate(frame, [205, 244], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EO,
  });
  const curX = interpolate(frame, [205, 258], [-172, -38], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EO,
  });
  const curY = interpolate(frame, [205, 258], [150, 6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EO,
  });
  const curClick = interpolate(frame, [260, 268, 280], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const clickDip = interpolate(frame, [260, 268, 280], [1, 0.92, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ripple = interpolate(frame, [264, 308], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EO,
  });
  // just after the click, a small downward settle before the intro lifts & fades away
  const curSettleY = interpolate(frame, [268, 282], [0, 15], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EO,
  });
  // shiny-button hover buildup — the shine widens & blooms as the cursor approaches,
  // staying lit through the click; `curClick` doubles as the press/impact value.
  const btnHover = interpolate(frame, [228, 256], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EO,
  });

  // ── Logo — small at the top; fades in as the intro hands off to the content ──
  const logoOpacity = interpolate(frame, [INTRO - 18, INTRO + 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EO,
  });
  const logoPulseBase = Math.sin(frame * 0.08) * 0.12 + 0.9;
  const s6PulseExtra = frame >= S6 ? Math.sin((frame - S6) * 0.065) * 0.2 : 0;
  const logoPulse = logoPulseBase + s6PulseExtra;
  // In ultrawide (21:9) the 2× scale makes the 5% downward drift feel huge — keep logo fixed.
  const logoTP3 = ultrawide ? 0 : interpolate(frame, [S6, S6 + 25], [0, 5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EO,
  });
  const logoTopPercent = 12 + logoTP3;
  const logoSc2 = interpolate(frame, [S6, S6 + 25], [0, 0.1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EO,
  });
  const logoScale = 0.72 + logoSc2;

  // ══════════════════════════════════════════
  // SCENE 3 — How it works (longer hold so it reads on a far screen)
  // ══════════════════════════════════════════
  const s3f = Math.max(0, frame - S3);
  const s3Active = frame >= S3 && frame < TEAM;
  const s3TitleOp = interpolate(s3f, [0, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EO,
  });
  const s3TitleY = interpolate(s3f, [0, 22], [28, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: DRIFT,
  });
  // Exit hand-off → Build Your Team: the title lifts, the side steps part outward
  // (left & right) and the MIDDLE step ("Build Your Team") rises up + leads into the
  // next scene, so the team mannequins feel like they grow out of that very step.
  const s3Exit = interpolate(s3f, [230, 258], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EI,
  });
  const STEP_DELAY = [34, 58, 82]; // 3 steps, staggered after the title settles

  // ══════════════════════════════════════════
  // SCENE 3.5 — Build Your Team
  // "A team of 2" holds → delay → "Up to 5 members" → settle & hold
  // ══════════════════════════════════════════
  const teamF = Math.max(0, frame - TEAM);
  const teamActive = frame >= TEAM && frame < S4;
  // "BUILD YOUR TEAM" heading — continues exactly from the risen middle step: it
  // starts at that step's spot (down + smaller) and rises + grows into the heading,
  // so the two read as ONE element morphing across the scene cut.
  const teamHeadOp = interpolate(teamF, [0, 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EO,
  });
  const teamHeadY = interpolate(teamF, [0, 30], [185, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: DRIFT,
  });
  const teamHeadScale = interpolate(teamF, [0, 30], [0.6, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: DRIFT,
  });
  // §3 Case A crossfade with a real beat between the two captions
  const tH1In = fadeScaleIn(teamF, 46, fps, 600);
  const tH1Out = fadeScaleOut(teamF, 150, fps, 220);
  const tH1Op = tH1In.opacity * tH1Out.opacity;
  const tH1Sc = tH1In.scale * tH1Out.scale;
  const tH2 = fadeScaleIn(teamF, 162, fps, 520);
  const teamGlow = Math.sin(teamF * 0.06) * 0.12 + 0.9;
  const blobFadeIn = interpolate(teamF, [0, 50], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const teamExitOp = interpolate(teamF, [252, 280], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EI,
  });
  const teamExitY = interpolate(teamF, [252, 280], [0, -90], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EI,
  });

  // ══════════════════════════════════════════
  // SCENE 4  (750 – 899) — Idea Bazaar
  // ══════════════════════════════════════════
  const s4f = Math.max(0, frame - S4);
  const s4Active = frame >= S4 && frame < S5;
  // Heading: title then subtitle build up (the "Idea Bazaar" badge was removed —
  // it clashed with the logo at the top).
  const s4Head = [0, 12].map((d) => ({
    op: interpolate(s4f, [6 + d, 26 + d], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EO,
    }),
    y: interpolate(s4f, [6 + d, 30 + d], [30, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: DRIFT,
    }),
  }));
  const s4ExitOp = interpolate(s4f, [188, 218], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EI,
  });
  const s4ExitY = interpolate(s4f, [188, 218], [0, -55], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EI,
  });
  // The whole feed block rises up into place as it appears; inside, the cards are
  // ALREADY mid-scroll (pre-offset), so cards drift above & below from frame one.
  const feedEnterY = interpolate(s4f, [4, 48], [140, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: DRIFT,
  });
  const feedEnterOp = interpolate(s4f, [4, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EO,
  });
  const COL_SPEEDS = [1.4, 1.0, 1.25]; // middle column slowest
  const COL_START = [-80, -150, -115]; // pre-scrolled so the feed is mid-flow at the top
  const colY = COL_SPEEDS.map((sp, i) => COL_START[i] - s4f * sp);

  // ══════════════════════════════════════════
  // SCENE 5  (900 – 1109) — Prizes
  // ══════════════════════════════════════════
  const s5f = Math.max(0, frame - S5);
  const s5Active = frame >= S5 && frame < S_SPEAKERS;
  const spotOp = interpolate(s5f, [0, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EO,
  });
  // Prizes heading — standard heading motion: fade + rise IN, then fade + rise-AWAY
  // on exit (matches How-it-works / Speakers / Idea-Bazaar for consistency).
  const prizeHeadOp = interpolate(s5f, [6, 28, 206, 236], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EO,
  });
  const prizeHeadY = interpolate(s5f, [6, 28, 206, 236], [28, 0, 0, -55], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EO,
  });
  // shimmer sweep across the winning card (loops every 150 frames)
  const shimmerX = interpolate((s5f % 150) / 150, [0, 1], [-75, 185]);
  const plusOp = interpolate(s5f, [96, 116], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EO,
  });
  const plusY = interpolate(s5f, [96, 116], [14, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EO,
  });
  // Prizes leave one-by-one — sides first, the winner lingers and exits last —
  // overlapping the CTA's entrance so there's no dead gap between scenes.
  const EXIT_BASE = 202,
    EXIT_STAGGER = 12; // winner (last) ends at s5f 256 = the S_SPEAKERS boundary
  const EXIT_STEP = [0, 2, 1]; // [2nd-left → first, 1st-centre → last, 3rd-right → middle]
  const plusExitOp = interpolate(s5f, [190, 214], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EI,
  });
  // Final resting tilt per card ([2nd-left, 1st-centre, 3rd-right]): side cards fan
  // toward the centre, the winner keeps a slight turn so the shimmer glances off it.
  const FINAL_TILT = [
    { rx: 5, ry: 13 }, // 2nd — left
    { rx: 6, ry: -7 }, // 1st — centre
    { rx: 5, ry: -13 }, // 3rd — right
  ];
  const podiumAnims = PODIUM_CARDS.map((c, i) => {
    const lf = Math.max(0, s5f - c.delay);
    const settle = interpolate(lf, [0, 42], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: DRIFT,
    });
    const ft = FINAL_TILT[i];
    // staggered, smooth one-by-one exit (slide up + fade away)
    const exitStart = EXIT_BASE + EXIT_STEP[i] * EXIT_STAGGER;
    const exitP = interpolate(s5f, [exitStart, exitStart + 30], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.cubic),
    });
    // gentle idle once settled (and calmed during exit): float + tilt sway add depth/life
    const idle = settle * (1 - exitP);
    const hover = Math.sin(s5f * 0.03 + i * 1.9) * 7 * idle; // vertical float
    const swayX = Math.sin(s5f * 0.026 + i * 1.3 + 0.7) * 1.2 * idle; // pitch wobble
    const swayY = Math.sin(s5f * 0.022 + i * 1.9) * 1.6 * idle; // yaw wobble
    return {
      // softer, longer entry — gentler rise + fade for a smoother appearance
      y: interpolate(lf, [0, 42], [470, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: DRIFT,
      }),
      op: interpolate(lf, [0, 26], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: EO,
      }),
      glow: interpolate(lf, [0, 22, 72], [0, 1.4, 0.5], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
      // tilt: leans back + turned harder on entry, eases to the gentle final angle + idle sway
      rotX: interpolate(settle, [0, 1], [ft.rx + 14, ft.rx]) + swayX,
      rotY: interpolate(settle, [0, 1], [ft.ry * 2.1, ft.ry]) + swayY,
      // staggered exit + idle float
      exitOp: 1 - exitP,
      exitY: exitP * -100,
      exitScl: 1 - exitP * 0.04,
      hover,
    };
  });

  // ══════════════════════════════════════════
  // SCENE 6  (1110 – 1319) — CTA
  // ══════════════════════════════════════════
  const s6f = Math.max(0, frame - S6);
  const s6Active = frame >= S6;
  // glow blooms immediately so the CTA picks up the instant WIT finishes dissolving
  const s6GlowOp = interpolate(s6f, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EO,
  });
  const w1Op = interpolate(s6f, [8, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EO,
  });
  const w1Y = interpolate(s6f, [8, 32], [34, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: DRIFT,
  });
  const w2Op = interpolate(s6f, [26, 46], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EO,
  });
  const w2Y = interpolate(s6f, [26, 50], [34, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: DRIFT,
  });
  const w3Op = interpolate(s6f, [38, 58], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EO,
  });
  const w3Y = interpolate(s6f, [38, 62], [34, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: DRIFT,
  });
  const s6Sub1Op = interpolate(s6f, [54, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EO,
  });
  const s6Sub1Y = interpolate(s6f, [54, 70], [10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EO,
  });
  const s6Sub2Op = interpolate(s6f, [72, 88], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EO,
  });
  const s6Sub2Y = interpolate(s6f, [72, 88], [10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EO,
  });
  // headline words snap from a soft blur into crisp focus as they rise (cinematic)
  const wBlur1 = interpolate(s6f, [8, 30], [12, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EO });
  const wBlur2 = interpolate(s6f, [26, 48], [12, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EO });
  const wBlur3 = interpolate(s6f, [38, 60], [12, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EO });
  // CTA button — a slow, very gentle "alive" shine that breathes (subtle, not pulsing fast)
  const ctaHover = 0.3 + Math.sin(s6f * 0.024) * 0.1;
  // graceful close — the whole frame eases very slightly toward the camera, then a
  // smooth (ease-in-out) fade to black so the ending settles instead of cutting.
  const s6Close = interpolate(s6f, [176, 208], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EO });
  const finalFade = interpolate(s6f, [186, 208], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });
  const btnOp = interpolate(s6f, [94, 118], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EO,
  });
  const btnY = interpolate(s6f, [94, 116], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EO,
  });
  const btnPulse = 1 + Math.sin(s6f * 0.018) * 0.01; // very slow, barely-there breathing
  // Wave rings — 3 capsules staggered by 1/3 period, emitting calmly outward.
  const wRing1 = waveForProgress((s6f % WAVE_PERIOD) / WAVE_PERIOD);
  const wRing2 = waveForProgress(((s6f + 50) % WAVE_PERIOD) / WAVE_PERIOD);
  const wRing3 = waveForProgress(((s6f + 100) % WAVE_PERIOD) / WAVE_PERIOD);

  // ══════════════════════════════════════════
  // SCENE S_SPEAKERS — Speakers & Mentors
  // ══════════════════════════════════════════
  const spkF = Math.max(0, frame - S_SPEAKERS);
  const spkActive = frame >= S_SPEAKERS && frame < S_WIT;
  // Heading (persists at the top while the carousel cycles below it)
  const spkHeadOp = interpolate(spkF, [0, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EO });
  const spkHeadY = interpolate(spkF, [0, 22], [28, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: DRIFT });
  // Whole carousel rises + fades into place, then exits the same way
  const spkEnterOp = interpolate(spkF, [10, 44], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EO });
  const spkEnterY = interpolate(spkF, [10, 50], [120, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: DRIFT });
  const spkExitOp = interpolate(spkF, [298, 328], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EI });
  const spkExitY = interpolate(spkF, [298, 328], [0, -60], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EI });
  // Carousel position — held on each speaker, then an eased slide to the next.
  // pos = 0 (Nitesh) → 1 (Shamik) → 2 (Pratyush). Each slide advances everything
  // leftward; the back card wraps in from the right (handled in render).
  const CAROUSEL_EASE = Easing.bezier(0.65, 0, 0.35, 1); // smooth in-out snap
  const spkSlide1 = interpolate(spkF, [104, 140], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: CAROUSEL_EASE });
  const spkSlide2 = interpolate(spkF, [200, 236], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: CAROUSEL_EASE });
  const spkPos = spkSlide1 + spkSlide2;

  // ══════════════════════════════════════════
  // SCENE S_WIT — Women in Tech
  // ══════════════════════════════════════════
  const witF = Math.max(0, frame - S_WIT);
  const witActive = frame >= S_WIT && frame < S6;
  // orbital geometry — concentric TRUE circles (no vertical squash) filling the canvas.
  // Centre sits a touch below mid-frame so the top faces stay clear of the logo.
  const WIT_CX = 640,
    WIT_CY = 378;
  // continuous slow orbit (degrees) — the whole circle drifts as one
  const witRot = witF * 0.16;
  // ── Waveform ripple — symmetric expansion. ENTRY: each element grows out from the
  //    centre (≈0 → rest), staggered inner-first. EXIT: instead of collapsing, it keeps
  //    expanding outward (rest → ~1.5×) while blurring + fading — "expands and blurs away"
  //    toward infinity. Same expansion language both ways, opposite direction. ──
  const witWave = (delay: number, exitDelay: number) => {
    const eP = interpolate(witF, [delay, delay + 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: DRIFT });
    const xP = interpolate(witF, [exitDelay, exitDelay + 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EI });
    return {
      eP,
      xP,
      appear: eP * (1 - xP),
      rFactor: (0.1 + 0.9 * eP) * (1 + 0.5 * xP),
    };
  };
  // centre logo / heading / subline — fade in once the ripple has assembled
  const witLogoOp = interpolate(witF, [30, 52], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EO });
  const witLogoY = interpolate(witF, [30, 52], [18, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: DRIFT });
  const witHeadOp = interpolate(witF, [40, 62], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EO });
  const witHeadY = interpolate(witF, [40, 62], [16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: DRIFT });
  const witSubOp = interpolate(witF, [52, 72], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EO });
  // centre exit — expands & fades away, finishing right at the S6 boundary so the
  // CTA picks up with no dead gap (smooth, synced hand-off)
  const witCenterExit = interpolate(witF, [200, 228], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EI });
  const witCenterExitScale = interpolate(witF, [200, 228], [1, 1.2], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EI });

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <AbsoluteFill
      style={{ background: T.paper, overflow: "hidden", fontFamily: T.font }}
    >
      {/* ── Animated grain-gradient backdrop (dark/brand, frame-driven) ── */}
      <GradientBackground />
      {/* ── Dot grid background (site pattern) ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          pointerEvents: "none",
        }}
      />
      {/* ── Subtle floating particles ── */}
      {SUBTLE_PX.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.r * 3,
            height: p.r * 3,
            borderRadius: "50%",
            background: p.c,
            opacity: Math.sin(frame * p.sp + i) * 0.055 + 0.1,
            boxShadow: `0 0 ${p.r * 4}px ${p.c}`,
          }}
        />
      ))}
      {/* ══════════ INTRO — "Got an idea?" → "Create a squad" button ══════════ */}
      {frame < INTRO && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: introOut,
            transform: `translateY(${introExitY}px)`,
          }}
        >
          {/* soft purple ambient glow */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 1120,
              height: 760,
              transform: "translate(-50%,-50%)",
              borderRadius: "50%",
              background: `radial-gradient(ellipse, ${T.purple}26 0%, ${T.accent}12 38%, transparent 70%)`,
              filter: "blur(40px)",
              opacity: introGlowOp,
              pointerEvents: "none",
            }}
          />

          {/* "Got" — rises up + slides left into place, then anchors to the button's left */}
          <div
            style={{
              position: "absolute",
              left: `calc(50% + ${boxOffsetX}px - ${boxW / 2 + 18}px)`,
              top: "50%",
              transform: `translate(calc(-100% - ${sideShift}px + ${enterGot.x}px), calc(-50% + ${enterGot.y}px))`,
              opacity: enterGot.op * sideFade,
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                fontFamily: T.display,
                fontSize: 92,
                fontWeight: 400,
                color: "#FFFFFF",
                letterSpacing: "1px",
                textTransform: "uppercase",
              }}
            >
              Got
            </span>
          </div>

          {/* "an idea?" — rises up + slides left into place, then anchors to button's right */}
          <div
            style={{
              position: "absolute",
              left: `calc(50% + ${boxOffsetX}px + ${boxW / 2 + 18}px)`,
              top: "50%",
              transform: `translate(${sideShift + enterIdea.x}px, calc(-50% + ${enterIdea.y}px))`,
              opacity: enterIdea.op * sideFade,
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                fontFamily: T.display,
                fontSize: 92,
                fontWeight: 400,
                background: T.grad,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                letterSpacing: "1px",
                textTransform: "uppercase",
              }}
            >
              an idea?
            </span>
          </div>

          {/* Morphing button — bulb SQUARE widens into the "Create a squad" rectangle,
              the emoji swaps up for the label inside the (overflow-clipped) frame */}
          <div
            style={{
              position: "absolute",
              left: `calc(50% + ${boxOffsetX}px)`,
              top: "50%",
              transform: `translate(calc(-50% + ${enterBulb.x}px), calc(-50% + ${enterBulb.y}px)) scale(${(0.82 + 0.18 * enterBulb.op) * clickDip})`,
              opacity: enterBulb.op,
            }}
          >
            {/* click ripple — purple, matches the shiny theme */}
            {ripple > 0 && ripple < 1 && (
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: boxW,
                  height: 96,
                  borderRadius: 20,
                  transform: `translate(-50%,-50%) scale(${1 + ripple * 0.7})`,
                  border: `2px solid ${T.purple}`,
                  opacity: (1 - ripple) * 0.55,
                  pointerEvents: "none",
                }}
              />
            )}
            {/* Premium white shiny button — rotating conic shine + dots + shimmer + bloom */}
            <div style={{ width: boxW, height: 96 }}>
              <ShinyButton frame={frame} hover={btnHover} press={curClick} radius={20}>
                {/* emoji — rolls up and out the top */}
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: `translate(-50%,-50%) translateY(${emojiY}px)`,
                    opacity: bulbOp,
                    zIndex: 2,
                  }}
                >
                  <Img
                    src={staticFile("icons/idea-bulb.webp")}
                    style={{ width: 54, height: 54, display: "block", objectFit: "contain" }}
                  />
                </div>
                {/* label — rolls up from the bottom into place */}
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: `translate(-50%,-50%) translateY(${textY}px)`,
                    opacity: ctaTxtOp,
                    whiteSpace: "nowrap",
                    zIndex: 2,
                  }}
                >
                  <span
                    style={{
                      fontFamily: T.head,
                      fontSize: 30,
                      fontWeight: 700,
                      color: T.paper,
                      letterSpacing: "-0.4px",
                    }}
                  >
                    Create a squad
                  </span>
                </div>
              </ShinyButton>
            </div>
          </div>

          {/* cursor — purple navigation arrow; flies in, then tilts in 3D space & presses on click */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate(${curX}px, ${curY + curSettleY}px)`,
              opacity: curOp,
              pointerEvents: "none",
            }}
          >
            <div style={{ perspective: 520 }}>
              <svg
                width="92"
                height="92"
                viewBox="0 0 24 24"
                style={{
                  display: "block",
                  filter:
                    "drop-shadow(0 0 2px rgba(30,10,60,0.6)) drop-shadow(0 9px 16px rgba(0,0,0,0.45))",
                  transform: `rotateX(${46 * curClick}deg) rotateZ(${-8 * curClick}deg) translateY(${9 * curClick}px) scale(${1 - 0.12 * curClick})`,
                  transformOrigin: "92% 8%",
                }}
              >
                <path
                  d="M3 11 L22 2 L13 21 L11 13 Z"
                  fill="#B14DFF"
                  stroke="#B14DFF"
                  strokeWidth="3.2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>
      )}
      {/* ── Logo — persists across all scenes; sits on TOP of everything (zIndex) ── */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: `${logoTopPercent}%`,
          transform: `translate(-50%,-50%) scale(${logoScale})`,
          opacity: logoOpacity,
          zIndex: 3000,
        }}
      >
        {/* dark backdrop so any scene content passes cleanly BEHIND the logo */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: LOGO_W + 60,
            height: LOGO_H + 26,
            transform: "translate(-50%,-50%)",
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse, rgba(8,6,18,0.92) 0%, rgba(8,6,18,0.7) 48%, transparent 74%)",
            filter: "blur(14px)",
            pointerEvents: "none",
          }}
        />
        <Img
          src={LOGO_URL}
          width={LOGO_W}
          height={LOGO_H}
          style={{
            display: "block",
            position: "relative",
            filter: `drop-shadow(0 0 ${16 * logoPulse}px rgba(255,63,108,0.6)) drop-shadow(0 0 ${28 * logoPulse}px rgba(174,51,255,0.35))`,
          }}
        />
      </div>
      {/* ── Hackerramp logo — small, top-right corner; also on TOP of everything ── */}
      <div
        style={{
          position: "absolute",
          right: 28,
          top: 50,
          opacity: logoOpacity * 0.9,
          zIndex: 3000,
        }}
      >
        <Img
          src={staticFile("hackerramp-logo.png")}
          style={{ display: "block", height: 22, width: "auto" }}
        />
      </div>
      {/* ══════════ SCENE 3 — How it works (3-step stepper, dark glass) ══════════ */}
      {s3Active && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Title — lifts away first on exit */}
          <h2
            style={{
              fontFamily: T.display,
              fontSize: 86,
              fontWeight: 400,
              color: "#FFFFFF",
              margin: "0 0 84px",
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              lineHeight: 1,
              opacity: s3TitleOp * (1 - s3Exit),
              transform: `translateY(${s3TitleY - 70 * s3Exit}px)`,
            }}
          >
            How It{" "}
            <span
              style={{
                background: T.grad,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Works
            </span>
          </h2>

          {/* Steps + connectors */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "center",
            }}
          >
            {STEPS.map((s, i) => {
              const start = S3 + STEP_DELAY[i];
              const tile = popIn(frame, start, fps, 0.5, 450); // §2 Dramatic Pop
              const lf = Math.max(0, frame - start);
              const connDraw = interpolate(lf, [8, 30], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: EO,
              });
              const titleOp = interpolate(lf, [14, 32], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: EO,
              });
              const titleY = interpolate(lf, [14, 34], [18, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: DRIFT,
              });
              // exit hand-off → Build Your Team. Sides (0,2) part outward + fade. The
              // middle ("Build Your Team") stays full-opacity, drops its icon, and
              // rises + grows so it hands SEAMLESSLY to the next scene's heading.
              const isMid = i === 1;
              const partX = (i === 0 ? -320 : i === 2 ? 320 : 0) * s3Exit;
              const riseY = (isMid ? -132 : 40) * s3Exit;
              const colOp = isMid ? 1 : 1 - s3Exit;
              const iconFade = isMid ? Math.max(0, 1 - s3Exit * 1.7) : 1;
              const titleGrow = isMid ? 1 + 0.12 * s3Exit : 1;
              return (
                <React.Fragment key={i}>
                  {/* Step column */}
                  <div
                    style={{
                      width: 300,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                      opacity: colOp,
                      transform: `translate(${partX}px, ${riseY}px)`,
                    }}
                  >
                    {/* dark glass tile — accent glow, white icon */}
                    <div
                      style={{
                        width: 148,
                        height: 148,
                        borderRadius: 32,
                        background: `radial-gradient(circle at 50% 28%, rgba(${s.glow},0.42) 0%, rgba(15,14,28,0.95) 68%)`,
                        border: `2px solid rgba(${s.glow},0.65)`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: `0 0 56px rgba(${s.glow},0.5), 0 20px 48px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.14)`,
                        backdropFilter: "blur(6px)",
                        opacity: tile.opacity * iconFade,
                        transform: `scale(${tile.scale})`,
                      }}
                    >
                      <StepIcon i={i} />
                    </div>
                    <h3
                      style={{
                        fontFamily: T.display,
                        fontSize: 40,
                        fontWeight: 400,
                        color: "#FFFFFF",
                        margin: "26px 0 0",
                        letterSpacing: "0.8px",
                        textTransform: "uppercase",
                        lineHeight: 1,
                        opacity: titleOp,
                        transform: `translateY(${titleY}px) scale(${titleGrow})`,
                      }}
                    >
                      {s.title}
                    </h3>
                  </div>

                  {/* Dashed connector (between tiles only) — draws in, simply fades on exit */}
                  {i < STEPS.length - 1 && (
                    <div
                      style={{
                        width: 120,
                        marginTop: 56,
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        opacity: connDraw * (1 - s3Exit),
                        transform: `scaleX(${connDraw})`,
                        transformOrigin: "left center",
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: T.purple,
                          flexShrink: 0,
                          boxShadow: `0 0 8px ${T.purple}`,
                        }}
                      />
                      <span
                        style={{
                          flex: 1,
                          height: 0,
                          borderTop: `2px dashed ${T.line3}`,
                        }}
                      />
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: T.accent,
                          flexShrink: 0,
                          boxShadow: `0 0 8px ${T.accent}`,
                        }}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}
      {/* ══════════ SCENE 3.5 — Build Your Team ══════════ */}
      {teamActive && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: teamExitOp,
            transform: `translateY(${teamExitY}px)`,
          }}
        >
          {/* warm glow pooled behind the group (brand-tinted) */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "66%",
              width: 940,
              height: 600,
              transform: "translate(-50%,-50%)",
              borderRadius: "50%",
              background: `radial-gradient(ellipse, rgba(255,63,108,${0.3 * teamGlow}) 0%, rgba(174,51,255,${0.12 * teamGlow}) 46%, transparent 72%)`,
              filter: "blur(26px)",
              zIndex: 1,
              opacity: blobFadeIn,
            }}
          />

          {/* team figures — real mannequins rising into a group, cut off at the bottom */}
          {TEAM_IMGS.map((p) => (
            <TeamFigure key={p.id} p={p} tf={teamF} fps={fps} />
          ))}

          {/* text-clear gradient — sits above figures (z:15) below heading (z:20),
              fades from solid background at the top to transparent so the heading
              zone is never obscured by figure bodies at any animation frame */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 270,
              background: `linear-gradient(to bottom, ${T.paper} 32%, transparent 100%)`,
              zIndex: 15,
              pointerEvents: "none",
            }}
          />

          {/* caption — "BUILD YOUR TEAM" continues from the rising middle step above,
              with a clear member-count line that grows 2 → 5 as the squad fills in */}
          <div
            style={{
              position: "absolute",
              top: 142,
              left: 0,
              right: 0,
              textAlign: "center",
              zIndex: 20,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontFamily: T.display,
                fontSize: 74,
                fontWeight: 400,
                color: "#FFFFFF",
                letterSpacing: "1.6px",
                textTransform: "uppercase",
                lineHeight: 1,
                opacity: teamHeadOp,
                transform: `translateY(${teamHeadY}px) scale(${teamHeadScale})`,
              }}
            >
              Build Your{" "}
              <span
                style={{
                  background: T.grad,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Team
              </span>
            </h2>
            {/* member-count instruction — crossfades 2 → 5 as members join */}
            <div style={{ position: "relative", height: 42, marginTop: 16 }}>
              <p
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: 0,
                  fontFamily: T.head,
                  fontSize: 28,
                  fontWeight: 500,
                  color: T.mute1,
                  letterSpacing: "0.1px",
                  opacity: tH1Op,
                  transform: `scale(${tH1Sc})`,
                }}
              >
                Start with at least&nbsp;
                <b style={{ color: "#FFFFFF", fontWeight: 800 }}>2</b>
                &nbsp;members
              </p>
              <p
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: 0,
                  fontFamily: T.head,
                  fontSize: 28,
                  fontWeight: 500,
                  color: T.mute1,
                  letterSpacing: "0.1px",
                  opacity: tH2.opacity,
                  transform: `scale(${tH2.scale})`,
                }}
              >
                Grow your squad up to&nbsp;
                <b
                  style={{
                    background: T.grad,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    fontWeight: 800,
                  }}
                >
                  5
                </b>
                &nbsp;members
              </p>
            </div>
          </div>

        </div>
      )}
      {/* ══════════ SCENE 4 — Idea Bazaar (minimal) ══════════ */}
      {s4Active && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: s4ExitOp,
            transform: `translateY(${s4ExitY}px)`,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Heading — title then subtitle build up from below (clear of the logo) */}
          <div style={{ textAlign: "center", paddingTop: 132, flexShrink: 0 }}>
            <h2
              style={{
                fontFamily: T.display,
                fontSize: 68,
                fontWeight: 400,
                color: "#FFFFFF",
                margin: "0 0 12px",
                letterSpacing: "1.2px",
                textTransform: "uppercase",
                lineHeight: 1,
                opacity: s4Head[0].op,
                transform: `translateY(${s4Head[0].y}px)`,
              }}
            >
              Ideas Worth{" "}
              <span
                style={{
                  background: T.grad,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Building
              </span>
            </h2>
            <p
              style={{
                fontSize: 18,
                color: T.mute3,
                margin: 0,
                fontWeight: 400,
                opacity: s4Head[1].op,
                transform: `translateY(${s4Head[1].y}px)`,
              }}
            >
              Real problems, pitched by Myntra teams.
            </p>
          </div>

          {/* Feed block — rises into place while the cards inside scroll continuously */}
          <div
            style={{
              flex: 1,
              marginTop: 30,
              overflow: "hidden",
              position: "relative",
              opacity: feedEnterOp,
              transform: `translateY(${feedEnterY}px)`,
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)",
              maskImage:
                "linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 32,
                height: "100%",
              }}
            >
              {[IDEAS.slice(0, 3), IDEAS.slice(3, 6), IDEAS.slice(6, 9)].map(
                (col, ci) => (
                  <div
                    key={ci}
                    style={{
                      position: "relative",
                      width: 318,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: 24,
                        transform: `translateY(${colY[ci]}px)`,
                      }}
                    >
                      {[...col, ...col, ...col].map((idea, i) => (
                        <div
                          key={i}
                          style={{
                            background: "rgba(20,18,36,0.72)",
                            border: "1px solid rgba(255,255,255,0.10)",
                            borderRadius: 20,
                            padding: "24px 24px 20px",
                            boxShadow: "0 10px 26px rgba(0,0,0,0.38)",
                          }}
                        >
                          {/* idea number badge */}
                          <span
                            style={{
                              display: "inline-block",
                              fontSize: 11,
                              fontWeight: 700,
                              color: T.mute4,
                              letterSpacing: "1.5px",
                              fontFamily: "'JetBrains Mono', monospace",
                              marginBottom: 10,
                            }}
                          >
                            #{idea.id}
                          </span>
                          <p
                            style={{
                              margin: 0,
                              fontSize: 15,
                              lineHeight: 1.58,
                              color: T.mute1,
                              fontWeight: 400,
                            }}
                          >
                            {idea.text}
                          </p>
                          {/* submitter row — avatar + name */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              marginTop: 18,
                              paddingTop: 14,
                              borderTop: `1px solid ${T.line}`,
                            }}
                          >
                            <div
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: "50%",
                                overflow: "hidden",
                                flexShrink: 0,
                                border: "1.5px solid rgba(255,255,255,0.14)",
                                background: "linear-gradient(135deg, #2A1A4A 0%, #1A1030 100%)",
                              }}
                            >
                              <Img
                                src={staticFile(idea.avatar)}
                                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
                              />
                            </div>
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 500,
                                color: T.mute2,
                                letterSpacing: "0.1px",
                              }}
                            >
                              {idea.name}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      )}
      {/* ══════════ SCENE 5 — Prizes ══════════ */}
      {s5Active && (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.22)",
              opacity: spotOp,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse 700px 380px at 50% -4%,rgba(245,158,11,0.07) 0%,transparent 65%)",
              opacity: spotOp,
            }}
          />

          {/* Heading — sits clear of the logo */}
          <div
            style={{
              position: "absolute",
              top: 142,
              left: 0,
              right: 0,
              textAlign: "center",
              opacity: prizeHeadOp,
              transform: `translateY(${prizeHeadY}px)`,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontFamily: T.display,
                fontSize: 58,
                fontWeight: 400,
                color: "#FFFFFF",
                letterSpacing: "1.4px",
                textTransform: "uppercase",
                lineHeight: 1,
              }}
            >
              Prizes &amp;{" "}
              <span
                style={{
                  background: T.gradLong,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Rewards
              </span>
            </h2>
          </div>

          <div
            style={{
              position: "absolute",
              top: 214,
              left: 40,
              right: 40,
              bottom: 24,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 22,
                width: "100%",
              }}
            >
              {PODIUM_CARDS.map((card, i) => {
                const {
                  y,
                  op,
                  glow,
                  rotX,
                  rotY,
                  exitOp,
                  exitY,
                  exitScl,
                  hover,
                } = podiumAnims[i];
                const g = `rgba(${card.glowRgb},`;
                const isFirst = card.rank === "1ST PLACE";
                return (
                  // Outer layer — vertical rise + idle hover + staggered exit in clean screen space.
                  <div
                    key={i}
                    style={{
                      width: isFirst ? 462 : 334,
                      flexShrink: 0,
                      opacity: op * exitOp,
                      transform: `translateY(${y + card.lift + exitY + hover}px) scale(${exitScl})`,
                    }}
                  >
                    {/* Inner layer — true 3D tilt; the shimmer glances across this surface. */}
                    <div
                      style={{
                        transform: `perspective(1500px) rotateX(${rotX}deg) rotateY(${rotY}deg)`,
                        transformStyle: "preserve-3d",
                        background: T.paper2,
                        border: `1.5px solid ${card.borderColor}`,
                        borderRadius: 22,
                        padding: isFirst ? "44px 40px 42px" : "30px 26px",
                        boxShadow: isFirst
                          ? `0 0 ${70 * glow}px ${g}0.42), 0 0 ${140 * glow}px ${g}0.24), 0 30px 74px rgba(0,0,0,0.82)`
                          : `0 0 ${44 * glow}px ${g}0.22), 0 0 ${80 * glow}px ${g}0.11), 0 26px 64px rgba(0,0,0,0.78)`,
                        display: "flex",
                        flexDirection: "column",
                        position: "relative",
                      }}
                    >
                      {/* Shimmer sweep — winning card only: thick soft gradient band */}
                      {isFirst && (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            borderRadius: 22,
                            overflow: "hidden",
                            pointerEvents: "none",
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              top: -60,
                              bottom: -60,
                              width: 124,
                              left: `${shimmerX}%`,
                              background:
                                "linear-gradient(90deg, transparent, rgba(255,255,255,0.20) 42%, rgba(255,255,255,0.22) 58%, transparent)",
                              transform: "skewX(-14deg)",
                              filter: "blur(7px)",
                            }}
                          />
                        </div>
                      )}
                      {/* Trophy — overhangs the top-right corner */}
                      <div
                        style={{
                          position: "absolute",
                          top: isFirst ? -96 : -78,
                          right: -28,
                          width: isFirst ? 240 : 198,
                          height: isFirst ? 330 : 272,
                        }}
                      >
                        <Img
                          src={card.medalUrl}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                            filter: `drop-shadow(0 4px 16px ${g}0.5))`,
                          }}
                        />
                      </div>
                      {/* Rank + event */}
                      <p
                        style={{
                          fontSize: isFirst ? 13 : 12,
                          fontWeight: 700,
                          color: card.rankColor,
                          letterSpacing: "3px",
                          textTransform: "uppercase",
                          margin: "0 0 7px",
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        {card.rank}
                      </p>
                      <p
                        style={{
                          fontSize: 14,
                          color: T.mute4,
                          margin: "0 0 14px",
                          fontWeight: 400,
                        }}
                      >
                        {card.event}
                      </p>
                      <div
                        style={{
                          height: 1,
                          background: T.line2,
                          margin: "4px 0 16px",
                        }}
                      />
                      <p
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: T.mute4,
                          letterSpacing: "2.5px",
                          textTransform: "uppercase",
                          margin: "0 0 10px",
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        Cash Prize
                      </p>
                      <h3
                        style={{
                          fontFamily: T.head,
                          fontSize: isFirst ? 52 : 42,
                          fontWeight: 700,
                          color: "#FFFFFF",
                          margin: 0,
                          letterSpacing: "-0.5px",
                          lineHeight: 1,
                        }}
                      >
                        {card.prize}
                      </h3>
                    </div>
                  </div>
                );
              })}
            </div>
            <div
              style={{
                opacity: plusOp * plusExitOp,
                transform: `translateY(${plusY}px)`,
                marginTop: 20,
                textAlign: "center",
              }}
            >
              <p
                style={{
                  fontSize: 15,
                  color: T.mute3,
                  margin: 0,
                  fontWeight: 400,
                }}
              >
                <span style={{ color: T.accent, fontWeight: 600 }}>Plus: </span>
                Special Awards (Best UI/UX &nbsp;·&nbsp; Most Innovative &nbsp;·&nbsp; Live Implementation) &nbsp;·&nbsp; Fun Games &amp; Spot Prizes
              </p>
            </div>
          </div>
        </>
      )}
      {/* ══════════ SCENE S_SPEAKERS — Speakers & Mentors (coverflow) ══════════ */}
      {spkActive && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: spkExitOp,
            transform: `translateY(${spkExitY}px)`,
          }}
        >
          {/* Ambient glow behind the carousel */}
          <div
            style={{
              position: "absolute",
              top: "56%",
              left: "50%",
              width: 900,
              height: 540,
              borderRadius: "50%",
              background: `radial-gradient(ellipse, ${T.purple}22 0%, ${T.accent}12 45%, transparent 70%)`,
              transform: "translate(-50%,-50%)",
              filter: "blur(60px)",
              pointerEvents: "none",
            }}
          />

          {/* Heading — anchored below the logo so it never collides with it */}
          <div
            style={{
              position: "absolute",
              top: 139,
              left: 0,
              right: 0,
              textAlign: "center",
            }}
          >
            <h2
              style={{
                fontFamily: T.display,
                fontSize: 60,
                fontWeight: 400,
                color: "#FFFFFF",
                margin: 0,
                letterSpacing: "1.4px",
                textTransform: "uppercase",
                lineHeight: 1,
                opacity: spkHeadOp,
                transform: `translateY(${spkHeadY}px)`,
              }}
            >
              Speakers &amp;{" "}
              <span
                style={{
                  background: T.grad,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Mentors.
              </span>
            </h2>
          </div>

          {/* Coverflow stage — centre card sharp, side cards blurred & pushed back */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: spkEnterOp,
              perspective: 1400,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: 387,
                transform: `translate(-50%,-50%) translateY(${spkEnterY}px)`,
                transformStyle: "preserve-3d",
              }}
            >
              {SPEAKERS.map((s, i) => {
                const N = SPEAKERS.length;
                // wrap relative position into [-N/2, N/2] so the carousel loops
                let rel = i - spkPos;
                rel = rel - N * Math.round(rel / N);
                const absRel = Math.abs(rel);
                const center = Math.max(0, 1 - absRel); // 1 at centre, 0 at sides
                const scale = interpolate(absRel, [0, 1], [1, 0.82], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });
                const tx = rel * 286;
                const rotY = interpolate(rel, [-1, 0, 1], [30, 0, -30], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });
                const blur = interpolate(absRel, [0, 0.45, 1], [0, 0.6, 6.5], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });
                const op = interpolate(absRel, [0, 1, 1.5], [1, 0.62, 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });
                // gentle idle life — a slow vertical float + yaw sway, strongest on the
                // focused (centre) card so it doesn't read as a flat static row
                const idleY = Math.sin(spkF * 0.045 + i * 1.7) * 9 * (0.35 + 0.65 * center);
                const idleRot = Math.sin(spkF * 0.032 + i * 1.1) * 2.4 * center;
                const CARD_W = 260,
                  CARD_H = 340;
                return (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      width: CARD_W,
                      height: CARD_H,
                      marginLeft: -CARD_W / 2,
                      marginTop: -CARD_H / 2,
                      borderRadius: 22,
                      overflow: "hidden",
                      border: "1px solid rgba(255,255,255,0.12)",
                      transform: `translateX(${tx}px) translateY(${idleY}px) scale(${scale}) rotateY(${rotY + idleRot}deg)`,
                      opacity: op,
                      zIndex: Math.round(100 - absRel * 20),
                      filter: `blur(${blur}px)`,
                      boxShadow: `0 34px 70px -22px rgba(0,0,0,0.78), 0 0 ${46 * center}px rgba(174,51,255,${0.4 * center})`,
                    }}
                  >
                    {/* full-bleed headshot (studio lighting baked in) */}
                    <Img
                      src={s.img}
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        objectPosition: "center top",
                      }}
                    />
                    {/* bottom gradient scrim for text legibility */}
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background:
                          "linear-gradient(to top, rgba(8,6,18,0.96) 0%, rgba(8,6,18,0.78) 20%, rgba(8,6,18,0.18) 44%, transparent 62%)",
                      }}
                    />
                    {/* text block */}
                    <div
                      style={{
                        position: "absolute",
                        left: 22,
                        right: 22,
                        bottom: 20,
                      }}
                    >
                      <p
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: "rgba(255,255,255,0.55)",
                          letterSpacing: "2.5px",
                          textTransform: "uppercase",
                          margin: "0 0 6px",
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        Speaker
                      </p>
                      <p
                        style={{
                          fontFamily: T.head,
                          fontSize: 26,
                          fontWeight: 700,
                          color: "#FFFFFF",
                          margin: "0 0 12px",
                          letterSpacing: "-0.4px",
                          lineHeight: 1,
                        }}
                      >
                        {s.name}
                      </p>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 9,
                        }}
                      >
                        <div
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 8,
                            background: "#FFFFFF",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                          }}
                        >
                          <Img
                            src={s.logo}
                            style={{
                              width: 20,
                              height: 20,
                              objectFit: "contain",
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: 12,
                            color: T.mute1,
                            fontWeight: 500,
                            lineHeight: 1.25,
                          }}
                        >
                          {s.role} · {s.company}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ SCENE S_WIT — Women in Tech (orbital Leadership Circle) ══════════ */}
      {witActive && (
        <div style={{ position: "absolute", inset: 0 }}>
          {/* rose + violet ambient glow pooled behind the rings */}
          <div
            style={{
              position: "absolute",
              left: WIT_CX,
              top: WIT_CY,
              width: 880,
              height: 660,
              borderRadius: "50%",
              background:
                "radial-gradient(ellipse, rgba(255,45,120,0.16) 0%, rgba(176,50,255,0.10) 44%, transparent 72%)",
              transform: "translate(-50%,-50%)",
              filter: "blur(58px)",
              pointerEvents: "none",
            }}
          />

          {/* concentric TRUE-circle rings — fade outward, ripple in / collapse out */}
          <svg
            width={1280}
            height={720}
            style={{ position: "absolute", inset: 0 }}
          >
            <defs>
              <linearGradient id="witRing" x1="0" y1="0" x2="1" y2="0.3">
                <stop offset="0%" stopColor="#FF2D78" />
                <stop offset="50%" stopColor="#B032FF" />
                <stop offset="100%" stopColor="#36C5FF" />
              </linearGradient>
            </defs>
            {WIT_SHELLS.map((s, si) => {
              const w = witWave(si * 7, 200 + (WIT_SHELLS.length - 1 - si) * 3);
              return (
                <circle
                  key={si}
                  cx={WIT_CX}
                  cy={WIT_CY}
                  r={s.r * w.rFactor}
                  fill="none"
                  stroke="url(#witRing)"
                  strokeWidth={1.4}
                  opacity={w.appear * s.fade * 0.6}
                />
              );
            })}
          </svg>

          {/* the Leadership Circle — faces fan outward, sharp at centre → blurred far out.
              On exit they keep expanding outward + blur up + fade (no collapse). */}
          {WIT_DOTS.map((d, i) => {
            const norm = (d.r - WIT_SHELLS[0].r) / (WIT_SHELLS[WIT_SHELLS.length - 1].r - WIT_SHELLS[0].r);
            const w = witWave(norm * 32, 198 + norm * 6);
            const ang = ((d.angle + witRot) * Math.PI) / 180;
            const r = d.r * w.rFactor;
            const x = WIT_CX + r * Math.cos(ang);
            const y = WIT_CY + r * Math.sin(ang);
            // grows in on entry, then a touch larger on exit (never shrinks)
            const scale = (0.32 + 0.68 * w.eP) * (1 + 0.14 * w.xP);
            const blur = d.blur + w.xP * 16; // dissolve into blur as it expands away
            const tba = !d.role; // "To be decided" placeholders
            return (
              <div
                key={`av-${i}`}
                style={{
                  position: "absolute",
                  left: x,
                  top: y,
                  transform: `translate(-50%,-50%) scale(${scale})`,
                  opacity: d.fade * w.appear,
                  filter: blur ? `blur(${blur}px)` : undefined,
                  zIndex: Math.round(1000 - d.r),
                }}
              >
                <MockAvatar size={WIT_AVATAR_SIZE} img={d.img} tint={d.tint} />
                {/* name label — confirmed leaders in white, placeholders muted italic */}
                {d.name && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: "50%",
                      transform: "translate(-50%, 6px)",
                      whiteSpace: "nowrap",
                      textAlign: "center",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: tba ? 11 : 12,
                        fontWeight: tba ? 600 : 700,
                        fontStyle: tba ? "italic" : "normal",
                        color: tba ? T.mute3 : "#FFFFFF",
                        letterSpacing: "0.1px",
                        textShadow: "0 2px 8px rgba(0,0,0,0.85)",
                      }}
                    >
                      {d.name}
                    </p>
                    {d.role && (
                      <p
                        style={{
                          margin: "2px 0 0",
                          fontSize: 9.5,
                          fontWeight: 500,
                          color: T.mute3,
                          textShadow: "0 2px 8px rgba(0,0,0,0.85)",
                        }}
                      >
                        {d.role}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* centre — WIT logo + internal "Leadership Circle" framing + event detail */}
          <div
            style={{
              position: "absolute",
              left: WIT_CX,
              top: WIT_CY,
              width: 270,
              transform: `translate(-50%,-50%) scale(${witCenterExitScale})`,
              textAlign: "center",
              opacity: witCenterExit,
              zIndex: 2000,
            }}
          >
            <Img
              src={staticFile("women-in-tech-logo.png")}
              style={{
                display: "block",
                width: 220,
                height: "auto",
                margin: "0 auto 16px",
                opacity: witLogoOp,
                transform: `translateY(${witLogoY}px)`,
                filter: "drop-shadow(0 0 22px rgba(255,45,120,0.45))",
              }}
            />
            <h2
              style={{
                fontFamily: T.display,
                fontSize: 34,
                fontWeight: 400,
                color: "#FFFFFF",
                margin: "0 0 8px",
                letterSpacing: "0.8px",
                textTransform: "uppercase",
                lineHeight: 1.04,
                opacity: witHeadOp,
                transform: `translateY(${witHeadY}px)`,
              }}
            >
              Meet the{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, #FF2D78, #B032FF)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Leadership Circle.
              </span>
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: 12.5,
                fontWeight: 600,
                color: T.mute2,
                letterSpacing: "0.3px",
                opacity: witSubOp,
              }}
            >
              Fri, July 17 &nbsp;·&nbsp; Myntra Campus
            </p>
          </div>
        </div>
      )}

      {/* ══════════ SCENE 6 — CTA ══════════ */}
      {s6Active && (
        <>
          {/* Mesh glow behind text */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: 900,
              height: 900,
              borderRadius: "50%",
              background: `radial-gradient(circle,${T.accent}2E 0%,${T.purple}1E 38%,transparent 68%)`,
              transform: "translate(-50%,-50%)",
              opacity: s6GlowOp,
              filter: "blur(44px)",
            }}
          />

          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              paddingTop: ultrawide ? 0 : 110,
              gap: 0,
              transform: `scale(${1 + 0.05 * s6Close})`,
            }}
          >
            {/* Register. Ideate. Win. — always first */}
            <div
              style={{
                display: "flex",
                gap: 18,
                alignItems: "baseline",
                justifyContent: "center",
                marginBottom: 26,
                order: 1,
              }}
            >
              {[
                { word: "Register.", op: w1Op, y: w1Y, b: wBlur1, grad: false },
                { word: "Ideate.", op: w2Op, y: w2Y, b: wBlur2, grad: false },
                { word: "Win.", op: w3Op, y: w3Y, b: wBlur3, grad: true },
              ].map((w, i) => (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    fontFamily: T.display,
                    fontSize: 110,
                    fontWeight: 400,
                    color: "#FFFFFF",
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    lineHeight: 1,
                    opacity: w.op,
                    transform: `translateY(${w.y}px)`,
                    filter: w.b > 0.05 ? `blur(${w.b}px)` : undefined,
                    ...(w.grad
                      ? {
                          background: T.grad,
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                        }
                      : {}),
                  }}
                >
                  {w.word}
                </span>
              ))}
            </div>

            {/* MynnovAIte 2026 — order 2 default, 3 in ultrawide (below button) */}
            <div
              style={{
                opacity: s6Sub1Op,
                transform: `translateY(${s6Sub1Y}px)`,
                marginBottom: 14,
                order: ultrawide ? 3 : 2,
              }}
            >
              <p
                style={{
                  fontFamily: T.head,
                  fontSize: 38,
                  fontWeight: 700,
                  background: T.grad,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  margin: 0,
                  letterSpacing: "-0.3px",
                  textAlign: "center",
                }}
              >
                MynnovAIte 2026
              </p>
            </div>

            {/* Applications Open Now — order 3 default, 4 in ultrawide (below button) */}
            <div
              style={{
                opacity: s6Sub2Op,
                transform: `translateY(${s6Sub2Y}px)`,
                marginBottom: 46,
                order: ultrawide ? 4 : 3,
              }}
            >
              <p
                style={{
                  fontSize: 19,
                  color: T.mute1,
                  margin: 0,
                  fontWeight: 400,
                  letterSpacing: "0.3px",
                  textAlign: "center",
                }}
              >
                Applications Open Now — Don't Miss Out
              </p>
            </div>

            {/* Register Your Team — order 4 default, 2 in ultrawide (right after title) */}
            <div
              style={{
                opacity: btnOp,
                transform: `translateY(${btnY}px)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                height: 96,
                order: ultrawide ? 2 : 4,
                marginBottom: ultrawide ? 20 : 0,
              }}
            >
              {[wRing1, wRing2, wRing3].map((r, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    width: 300,
                    height: 64,
                    borderRadius: 18,
                    background: "rgba(190,130,255,0.11)",
                    transform: `scale(${r.scale})`,
                    opacity: r.opacity * btnOp * 0.6,
                    filter: `blur(${r.blur + 9}px)`,
                    pointerEvents: "none",
                  }}
                />
              ))}
              {/* shiny rounded-rectangle button (matches "Create a squad") */}
              <div
                style={{
                  position: "relative",
                  zIndex: 2,
                  width: 300,
                  height: 64,
                  transform: `scale(${btnPulse})`,
                }}
              >
                <ShinyButton frame={frame} hover={ctaHover} radius={18}>
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 2,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 19,
                        fontWeight: 700,
                        color: T.paper,
                        letterSpacing: "0.2px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Register Your Team
                    </span>
                  </div>
                </ShinyButton>
              </div>
            </div>
          </div>

          {/* Final fade to black — sits ABOVE everything (incl. the logo) for a clean,
              unified fade-out so nothing pops while the frame settles to black */}
          {finalFade > 0 && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "#000000",
                opacity: finalFade,
                zIndex: 5000,
              }}
            />
          )}
        </>
      )}
    </AbsoluteFill>
  );
};
