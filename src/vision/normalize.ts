import type { Point3 } from './types';

const WRIST = 0;
const MIDDLE_MCP = 9;

/**
 * Landmarks -> 63 features. MUST stay identical to ml/features.py `normalize`
 * (checked by the parity test against parity-fixture.json).
 */
export function normalize(points: Point3[], aspect: number): Float32Array {
  const out = new Float32Array(63);
  const [wx, wy, wz] = points[WRIST];
  for (let i = 0; i < 21; i++) {
    out[i * 3] = (points[i][0] - wx) * aspect;
    out[i * 3 + 1] = points[i][1] - wy;
    out[i * 3 + 2] = (points[i][2] - wz) * aspect;
  }
  const m = MIDDLE_MCP * 3;
  let scale = Math.hypot(out[m], out[m + 1], out[m + 2]);
  if (scale < 1e-6) scale = 1;
  for (let i = 0; i < 63; i++) out[i] /= scale;
  return out;
}
