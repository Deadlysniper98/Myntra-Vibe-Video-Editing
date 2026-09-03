# Motion Design Specification: UI Transitions & Continuity

This document defines the motion design language, spatial flow, and exact animation properties for user interface (UI) transitions. It serves as the single source of truth for both Motion Designers (After Effects/Premiere) and UI Engineers.

---

## 1. Core Principles of Cinematic Motion

To achieve a professional, high-end feel, all animations must adhere to these three core pillars:

* **Spatial Anchoring:** Elements never appear out of nowhere. They emerge from a logical origin point and exit toward a clear destination.
* **Temporal Hierarchy:** Not everything moves at once. Staggering elements (choreography) guides the viewer’s eye naturally across the screen.
* **Real-World Inertia:** Perfect linear movement feels robotic. High-end motion uses aggressive easing to mimic real-world friction and energy.

---

## 2. Global Easing Curves & Timing

Professionals rarely use default curves. Use these precise cubic-bezier values for standardizing transitions across the project.

| Animation Style | Curve Type | Cubic-Bezier / Expression | Duration | Best Used For |
| :--- | :--- | :--- | :--- | :--- |
| **The Professional "Swift"** | Quad Out (Decel) | `cubic-bezier(0.25, 1, 0.5, 1)` | 300ms–400ms | General UI Entry, crisp and responsive. |
| **The Dramatic Pop** | Back Out | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 450ms | Modals, badges, impact moments. |
| **The Cinematic Drift** | Quint Out | `cubic-bezier(0.22, 1, 0.36, 1)` | 600ms–800ms | Large backgrounds, immersive full-screen transitions. |

---

## 3. Transition Matrix: Exit vs. Entry Properties

When a user triggers a new screen, the **Previous UI** and **New UI** must work in perfect synchronicity. 

### Case A: Standard Fade + Scale (The Modern App Standard)
*Best for dashboard widgets, cards, and clean UI navigation.*

#### 🛑 Previous UI (Exit)
* **Opacity:** `100%` $\rightarrow$ `0%`
* **Scale:** `100%` $\rightarrow$ `95%` (Slightly shrinks away into the background)
* **Easing:** `cubic-bezier(0.7, 0, 0.84, 0)` (Fast Out)
* **Duration:** `200ms`

#### 🎬 New UI (Entry)
* **Opacity:** `0%` $\rightarrow$ `100%`
* **Scale:** `105%` $\rightarrow$ `100%` (Smoothly settles down from the foreground)
* **Easing:** `cubic-bezier(0.22, 1, 0.36, 1)` (Cinematic Quint Out)
* **Duration:** `400ms`
* **Delay:** Starts at `100ms` (Staggered overlap with the Exit animation)

---

### Case B: Motion Blur + Directional Push (The Premium Executive Look)
*Best for full-screen transitions, presentations, and high-impact motion graphics.*

> ⚠️ **Professional Note:** True motion blur should be calculated dynamically based on velocity. If pre-rendering or using CSS, simulate this using a directional blur vector.
[Direction of Flow: Left to Right ➡️]
[Previous UI: Pushes out Right + Blurs] ---> [New UI: Arrives from Left + Settles]


#### 🛑 Previous UI (Exit)
* **Position (X-Axis):** `0px` $\rightarrow$ `+100px` (Pushes to the right)
* **Opacity:** `100%` $\rightarrow$ `0%`
* **Directional Blur:** `0px` $\rightarrow$ `30px` (Horizontal Blur Angle: `90°`)
* **Easing:** `cubic-bezier(0.3, 0, 1, 1)`
* **Duration:** `250ms`

#### 🎬 New UI (Entry)
* **Position (X-Axis):** `-150px` $\rightarrow$ `0px` (Enters from the left)
* **Opacity:** `0%` $\rightarrow$ `100%`
* **Directional Blur:** `40px` $\rightarrow$ `0px` (Blurs down to sharp focus)
* **Easing:** `cubic-bezier(0.16, 1, 0.3, 1)`
* **Duration:** `500ms`

---

### Case C: Gaussian Blur In / Blur Out (The Cinematic Lens Flare/Dream Style)
*Best for immersive media viewers, video players opening, or overlaying ambient menus.*

#### 🛑 Previous UI (Exit)
* **Gaussian Blur:** `0px` $\rightarrow$ `50px`
* **Opacity:** `100%` $\rightarrow$ `0%`
* **Scale:** `100%` $\rightarrow$ `110%` (Expands slightly into the camera)
* **Duration:** `300ms`

#### 🎬 New UI (Entry)
* **Gaussian Blur:** `80px` $\rightarrow$ `0px` (Snaps back into crisp focus)
* **Opacity:** `0%` $\rightarrow$ `100%`
* **Scale:** `90%` $\rightarrow$ `100%`
* **Duration:** `450ms`

---

## 4. Advanced Micro-Choreography

A professional motion artist knows that animating a whole screen as a single block looks amateur. Use the **Stagger Rule**:

[Parent Container Arrives] -> (0ms)
└── [Header Text Fades Up] -> (+40ms)
└── [Main Feature Graphic Scale In] -> (+80ms)
└── [CTA Buttons Fade In] -> (+120ms)


* **Stagger Offset:** Keep internal element delays between `30ms` and `50ms`. Anything higher feels sluggish; anything lower is imperceptible to the human eye.
* **Overshoot:** For playful or high-energy UIs, allow scale values to hit `103%` before settling