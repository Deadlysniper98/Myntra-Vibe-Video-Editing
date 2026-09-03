# `.motion` — Vibe's interactive vector format

Vibe has **two outputs**:

| | **Video** | **Motion** |
|---|---|---|
| Engine | Remotion (offline render) | real-time vector runtime |
| Ships as | `.mp4` / `.webm` | `.motion` JSON + a runtime |
| Runtime | — | React Native **Skia** on-device · SVG/Canvas in the web preview |
| Interactive | no | **yes** — driven by `setInput()` at runtime |
| Effects | anything (blur, shaders, audio…) | **limited on purpose** (see below) |

`.motion` is the Rive/Lottie-style output. The model acts as a **compiler**: natural
language → a `.motion` document. A developer drops that document into a single
`CustomMotionView` and drives it with inputs — no hand-written visual math.

## What it can and cannot do

This format runs at 60fps from a tiny portable spec, so its surface is **deliberately
small**. The ceiling *is* the feature.

- ✅ Vector shapes: `path`, `rectangle`, `circle` with solid hex fills
- ✅ Tween `x`, `y`, `scaleX`, `scaleY`, `rotation`, `opacity`, `fill` over time
- ✅ Named easings: `linear`, `easeIn`, `easeOut`, `easeInOut`, `spring`
- ✅ A state machine: `boolean` / `number` / `trigger` inputs → transitions → states
- ❌ No blur, motion blur, drop shadows, filters, image/video textures
- ❌ No audio, no gradients, no per-pixel compositing, no arbitrary code

Anything richer is a job for the **video** output, not `.motion`.

## Structure

Four root keys — `meta`, `canvas`, `timelines`, `stateMachine`. Full types live in
[`schema.ts`](./schema.ts); a JSON Schema for tooling/validation lives in
[`motion.schema.json`](./motion.schema.json); a worked example (a button that
scales + darkens while an `isPressed` boolean is held) is in
[`examples/button-press.motion.json`](./examples/button-press.motion.json).

```
meta          → { version, baseWidth, baseHeight, name? }
canvas.shapes → [ { id, type, fill, transform, …geometry } ]
timelines     → { name: { durationMs, loop?, keyframes: { shapeId: { prop: [keyframe…] } } } }
stateMachine  → { initial?, inputs, states, transitions }
```

## The compiler contract (for the AI layer)

When the AI generates a `.motion` document it must:

1. Output **only** a valid JSON object with exactly the four root keys — no prose, no
   React Native code, no CSS.
2. Stay inside the capability list above. If a request needs blur/video-grade effects,
   approximate within the vector vocabulary or route the user to the video output.
3. Reference only shape ids that exist in `canvas`, properties from the animatable
   whitelist, timelines that exist, and states/inputs that exist.

> Notes on v1 choices (open for review): easing is a **named set** rather than raw
> `cubic-bezier` strings, so web and Skia stay in exact agreement; `path` geometry uses
> an SVG `d` string (with `points` as a polyline fallback); per-shape geometry fields
> (`width`/`height`/`radius`) keep shapes self-describing.
