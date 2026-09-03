// Headless test for the platform-agnostic engine (no RN/Skia needed). Bundled +
// run via `npm test` (esbuild → node). Validates easing/sampling + the state machine.
import { MotionRuntime } from "./src/runtime";
import type { MotionDoc } from "./src/schema";
import doc from "./example/button-press.motion.json";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name} ${detail}`);
  }
}

const rt = new MotionRuntime(doc as unknown as MotionDoc, true);

// 1. Starts in the declared initial state, idle (isPressed defaults false).
check("initial state is 'idle'", rt.currentState === "idle", `got ${rt.currentState}`);

// 2. Setting the boolean input flips the state machine to 'pressed'.
rt.setInput("isPressed", true);
check("isPressed=true → 'pressed'", rt.currentState === "pressed", `got ${rt.currentState}`);

// 3. Mid-timeline, btn_bg.scaleX has eased partway from 1 → 0.94.
rt.tick(70);
const mid = rt.resolve();
const sx = mid.btn_bg.scaleX;
check("btn_bg.scaleX eased into (0.94, 1)", sx < 1 && sx > 0.94, `got ${sx}`);

// 4. The glow ripple is mid-fade and scaled up (opacity peaks at t=70).
check("btn_glow.opacity > 0 mid-press", mid.btn_glow.opacity > 0, `got ${mid.btn_glow.opacity}`);
check("btn_glow scaled up", mid.btn_glow.scaleX > 1, `got ${mid.btn_glow.scaleX}`);

// 5. fill interpolates toward the darker pressed color (still a valid hex).
check("btn_bg.fill is a hex string", /^#[0-9a-f]{6}$/i.test(mid.btn_bg.fill), `got ${mid.btn_bg.fill}`);

// 6. Releasing flips back to idle.
rt.setInput("isPressed", false);
check("isPressed=false → 'idle'", rt.currentState === "idle", `got ${rt.currentState}`);

// 7. At the end of a non-looping timeline, value clamps to the last keyframe.
rt.tick(10_000);
const end = rt.resolve();
check("btn_bg.scaleX settles to 1 at rest", Math.abs(end.btn_bg.scaleX - 1) < 1e-6, `got ${end.btn_bg.scaleX}`);

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
