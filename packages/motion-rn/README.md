# @vibe/motion-rn

The React Native + [Skia](https://shopify.github.io/react-native-skia/) runtime for
[`.motion`](../../src/motion/README.md) interactive vector animations — the on-device
consumer of Vibe's *motion* output (the Rive/Lottie-style sibling of the video output).

Your developer drops a `.motion` JSON file in and drives it with inputs. No
hand-written visual math, no per-component animation code.

## Install

```bash
npm install @vibe/motion-rn @shopify/react-native-skia
# Expo:
npx expo install @shopify/react-native-skia
```

Peer deps: `react`, `react-native`, `@shopify/react-native-skia`. Works with Expo
(SDK 50+) and bare RN (0.73+).

## Use

```tsx
import { useRef } from "react";
import { View, Button } from "react-native";
import { CustomMotionView, type CustomMotionViewRef } from "@vibe/motion-rn";

const data = require("./claude_generated_animation.motion.json");

export default function App() {
  const motionRef = useRef<CustomMotionViewRef>(null);
  return (
    <View style={{ flex: 1 }}>
      <CustomMotionView ref={motionRef} source={data} style={{ width: "100%", height: 400 }} />
      <Button title="Submit" onPress={() => motionRef.current?.setInput("isSuccess", true)} />
    </View>
  );
}
```

A runnable example (a button that reacts to a held `isPressed` boolean) is in
[`example/App.tsx`](./example/App.tsx).

## Ref API

| method | purpose |
|---|---|
| `setInput(name, value)` | set a `boolean`/`number` input; transitions evaluate immediately |
| `fireTrigger(name)` | fire a momentary `trigger` input |
| `play()` / `pause()` | control the animation clock |

## Architecture

- **`src/runtime.ts`** — `MotionRuntime`, a **platform-agnostic** engine (zero RN/Skia
  deps): keyframe sampling, easing, color lerp, and the state machine. This is the
  shared core a future web/SVG preview will reuse so both renderers agree exactly.
- **`src/CustomMotionView.tsx`** — the thin Skia layer: maps each resolved shape to a
  Skia node, scales the base coordinate space to fit, and runs the frame loop.
- **`src/schema.ts`** — `.motion` types (mirror of `src/motion/schema.ts`).

## Status & caveats

- The engine core is covered by a headless test: `npm test` (bundles with esbuild and
  runs on Node — no simulator needed). **The Skia rendering layer has not yet been run
  on a device/simulator** — verify it in your RN/Expo app.
- The frame loop currently re-resolves on the JS thread each frame (fine for typical
  UI-scale scenes). Moving it onto a reanimated/Skia clock worklet is a planned
  optimization for heavy scenes.
- `spring` easing is a static overshoot approximation; a velocity-based spring is a v2
  item. No blur/shadow/filter/audio by design — that's the *video* output's job.
