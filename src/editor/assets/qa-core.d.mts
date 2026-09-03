// Type declarations for qa-core.mjs (the implementation stays plain JS so the
// node selftest can import the exact same code tsc-free).

export interface AssetQAReport {
  width: number;
  height: number;
  alphaCoveragePct: number;
  subjectBBox: { x: number; y: number; w: number; h: number };
  marginPct: { top: number; right: number; bottom: number; left: number };
  edgeHaloScore: number;
  issues: string[];
  passes: boolean;
}

export function analyzeRGBA(data: Uint8ClampedArray, width: number, height: number): AssetQAReport;
