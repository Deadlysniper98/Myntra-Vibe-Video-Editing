// Deterministic asset QA — pure pixel math, no DOM, no Node APIs.
//
// This file is plain ESM JavaScript so the SAME implementation runs in two
// places: the browser (re-exported with types via src/editor/assets/qa.ts)
// and the node selftest (scripts/qa-selftest.mjs imports it directly).

/**
 * @typedef {Object} AssetQAReport
 * @property {number} width
 * @property {number} height
 * @property {number} alphaCoveragePct   subject pixels (alpha ≥ 128) / total, in %
 * @property {{x: number, y: number, w: number, h: number}} subjectBBox tight bbox of subject pixels
 * @property {{top: number, right: number, bottom: number, left: number}} marginPct margins around the bbox, in % of the image dimension
 * @property {number} edgeHaloScore      0 (clean cut) … 1 (heavy semi-transparent fringe / stray alpha noise)
 * @property {string[]} issues
 * @property {boolean} passes            true when no hard issue was found
 */

/** Alpha at or above this counts as "subject". */
const SUBJECT_ALPHA = 128;
/** Minimum acceptable resolution on the shorter side. */
const MIN_RESOLUTION = 512;
/** Width of the border band scanned for stray alpha noise, in px. */
const BORDER_BAND = 3;

const round2 = (n) => Math.round(n * 100) / 100;
const round3 = (n) => Math.round(n * 1000) / 1000;
const clamp01 = (n) => Math.max(0, Math.min(1, n));

/**
 * Analyze raw RGBA pixels of a (supposedly background-removed) asset.
 *
 * Deterministic checks:
 *  - minimum resolution (512px on the shorter side)
 *  - alpha coverage: how much of the canvas the subject occupies
 *  - tight subject bounding box + margins to every edge
 *  - edge-halo score: ratio of semi-transparent pixels to the subject
 *    boundary length (a clean anti-aliased cut has roughly a 1px semi ring;
 *    matting halos produce several times that) plus stray alpha noise inside
 *    a 3px band along the image borders
 *
 * `passes` is true when no HARD issue was found; soft warnings are still
 * appended to `issues` but do not fail the asset.
 *
 * @param {Uint8ClampedArray} data RGBA bytes, length = width*height*4
 * @param {number} width
 * @param {number} height
 * @returns {AssetQAReport}
 */
export function analyzeRGBA(data, width, height) {
  const total = width * height;

  let subject = 0; // alpha >= SUBJECT_ALPHA
  let semi = 0; // 0 < alpha < SUBJECT_ALPHA
  let transparent = 0; // alpha === 0
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const a = data[(row + x) * 4 + 3];
      if (a >= SUBJECT_ALPHA) {
        subject++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      } else if (a > 0) {
        semi++;
      } else {
        transparent++;
      }
    }
  }

  // Subject boundary length: subject pixels with at least one non-subject
  // 4-neighbor (image edge counts as non-subject).
  let boundary = 0;
  if (subject > 0) {
    const isSubject = (x, y) =>
      x >= 0 && y >= 0 && x < width && y < height && data[(y * width + x) * 4 + 3] >= SUBJECT_ALPHA;
    for (let y = minY; y <= maxY; y++) {
      const row = y * width;
      for (let x = minX; x <= maxX; x++) {
        if (data[(row + x) * 4 + 3] < SUBJECT_ALPHA) continue;
        if (!isSubject(x - 1, y) || !isSubject(x + 1, y) || !isSubject(x, y - 1) || !isSubject(x, y + 1)) {
          boundary++;
        }
      }
    }
  }

  // Stray alpha noise in the border band (specks near the edges are the usual
  // background-removal artifact).
  let bandVisible = 0;
  let bandCount = 0;
  const band = Math.min(BORDER_BAND, Math.floor(Math.min(width, height) / 2));
  for (let y = 0; y < height; y++) {
    const nearY = y < band || y >= height - band;
    for (let x = 0; x < width; x++) {
      if (!nearY && x >= band && x < width - band) {
        x = width - band - 1; // skip the interior of the row
        continue;
      }
      bandCount++;
      if (data[(y * width + x) * 4 + 3] > 16) bandVisible++;
    }
  }

  const alphaCoveragePct = round2((subject / Math.max(1, total)) * 100);
  const fullyOpaque = semi === 0 && transparent === 0;

  const subjectBBox =
    subject > 0
      ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
      : { x: 0, y: 0, w: 0, h: 0 };

  const marginPct =
    subject > 0
      ? {
          top: round2((minY / height) * 100),
          right: round2(((width - 1 - maxX) / width) * 100),
          bottom: round2(((height - 1 - maxY) / height) * 100),
          left: round2((minX / width) * 100),
        }
      : { top: 0, right: 0, bottom: 0, left: 0 };

  // Halo: a clean anti-aliased cutout carries roughly one semi-transparent
  // pixel per boundary pixel (hair/fur legitimately more) — score the EXCESS.
  const ringRatio = boundary > 0 ? semi / boundary : 0;
  const haloComponent = clamp01((ringRatio - 1.5) / 10);
  const strayComponent = clamp01((bandVisible / Math.max(1, bandCount)) * 4);
  const edgeHaloScore = fullyOpaque ? 0 : round3(clamp01(0.8 * haloComponent + 0.2 * strayComponent));

  /** @type {string[]} */
  const hard = [];
  /** @type {string[]} */
  const soft = [];

  if (Math.min(width, height) < MIN_RESOLUTION) {
    hard.push(`resolution ${width}x${height} is below the ${MIN_RESOLUTION}px minimum`);
  }
  if (subject === 0) {
    hard.push("no subject found (no pixels with alpha >= 128)");
  } else if (alphaCoveragePct < 2) {
    hard.push(`subject covers only ${alphaCoveragePct}% of the canvas`);
  }
  if (fullyOpaque) {
    hard.push("image is fully opaque — background has not been removed");
  }
  // Hair/fur legitimately produces wide semi-transparent regions, so only an
  // extreme excess is a hard failure; anything noticeable is a soft warning.
  if (edgeHaloScore > 0.6) {
    hard.push(`heavy edge halo (score ${edgeHaloScore}) — semi-transparent fringe around the subject`);
  } else if (edgeHaloScore > 0.25) {
    soft.push(`noticeable edge fringe (halo score ${edgeHaloScore})`);
  }
  if (subject > 0 && !fullyOpaque) {
    const touching = Object.entries(marginPct)
      .filter(([, v]) => v < 0.5)
      .map(([k]) => k);
    if (touching.length > 0) {
      soft.push(`subject touches the ${touching.join(", ")} edge${touching.length > 1 ? "s" : ""}`);
    }
    if (alphaCoveragePct < 10) {
      soft.push(`subject is small (${alphaCoveragePct}% coverage) — consider a tighter crop`);
    }
  }

  return {
    width,
    height,
    alphaCoveragePct,
    subjectBBox,
    marginPct,
    edgeHaloScore,
    issues: [...hard, ...soft],
    passes: hard.length === 0,
  };
}
