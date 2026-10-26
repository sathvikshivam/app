import type { HandFrame, Point3 } from './types';

/**
 * J and Z are the two ASL letters you *draw in the air*, so a single frame can't tell them apart
 * from I and D. This keeps a rolling window of the last ~1.4 s of hand landmarks and looks at the
 * fingertip's path:
 *   J = pinky-only hand shape whose pinky tip moves down and then hooks sideways.
 *   Z = index-only hand shape whose index tip zig-zags: across, back diagonally, across again.
 * Distances are measured in "palm units" (wrist → middle knuckle), so it works at any distance
 * from the camera, and only direction *changes* are counted, so mirroring doesn't matter.
 */

export type MotionLetter = 'J' | 'Z';

const WINDOW_MS = 1400;
const COOLDOWN_MS = 900;
const MIN_FRAMES = 10;
const SHAPE_SHARE = 0.6; // fraction of frames that must show the right hand shape

// Tuned on synthetic trajectories (scripts/motion-test.mts); see that file for the cases.
const Z_MIN_SPAN_X = 0.9; // the Z must be at least this wide
const Z_MIN_DROP_Y = 0.45; // ...and end lower than it started
const Z_TURN = 0.35; // how far you must move back before a direction change counts
const J_MIN_DROP_Y = 0.45; // the J's stem
const J_MIN_HOOK_X = 0.3; // the J's hook at the bottom
const J_MIN_PATH = 0.9;

type Sample = { t: number; p: Point3[] };

const WRIST = 0;
const TIPS = { index: 8, middle: 12, ring: 16, pinky: 20 } as const;
const MCPS = { index: 5, middle: 9, ring: 13, pinky: 17 } as const;
type Finger = keyof typeof TIPS;

const dist = (a: Point3, b: Point3) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** How far a fingertip reaches compared with its knuckle: ~2 when straight, ~1 when curled. */
function reach(p: Point3[], f: Finger) {
  return dist(p[TIPS[f]], p[WRIST]) / Math.max(dist(p[MCPS[f]], p[WRIST]), 1e-6);
}
const extended = (p: Point3[], f: Finger) => reach(p, f) > 1.55;
const curled = (p: Point3[], f: Finger) => reach(p, f) < 1.4;

/** Thumb tip distance to the middle finger's middle joint, in palm units: small when tucked in. */
const thumbOut = (p: Point3[]) => dist(p[4], p[10]) / Math.max(dist(p[MCPS.middle], p[WRIST]), 1e-6);

// I (thumb over the fingers) vs Y (thumb stuck out); D/1 vs L (thumb stuck out).
export const isJShape = (p: Point3[]) =>
  extended(p, 'pinky') && curled(p, 'index') && curled(p, 'middle') && curled(p, 'ring') && thumbOut(p) < 0.6;
export const isZShape = (p: Point3[]) =>
  extended(p, 'index') && curled(p, 'middle') && curled(p, 'ring') && curled(p, 'pinky') && thumbOut(p) < 0.9;

/** Number of left/right direction changes, ignoring wiggles smaller than `turn`. */
function reversals(xs: number[], turn: number) {
  let dir = 0;
  let anchor = xs[0]; // furthest point reached in the current direction
  let count = 0;
  for (const x of xs) {
    if (dir === 0) {
      if (Math.abs(x - anchor) > turn) {
        dir = Math.sign(x - anchor);
        anchor = x;
      }
    } else if ((x - anchor) * dir > 0) {
      anchor = x;
    } else if ((anchor - x) * dir > turn) {
      count++;
      dir = -dir;
      anchor = x;
    }
  }
  return count;
}

function smooth(xs: number[]) {
  return xs.map((_, i) => {
    const w = xs.slice(Math.max(0, i - 1), i + 2);
    return w.reduce((a, b) => a + b, 0) / w.length;
  });
}

export function detectZ(win: Sample[], palm: number): boolean {
  if (win.filter((s) => isZShape(s.p)).length < win.length * SHAPE_SHARE) return false;
  const xs = smooth(win.map((s) => s.p[TIPS.index][0] / palm));
  const ys = smooth(win.map((s) => s.p[TIPS.index][1] / palm));
  const span = Math.max(...xs) - Math.min(...xs);
  const drop = ys[ys.length - 1] - ys[0]; // image y grows downward
  const turns = reversals(xs, Z_TURN);
  return span >= Z_MIN_SPAN_X && drop >= Z_MIN_DROP_Y && turns >= 2 && turns <= 3;
}

export function detectJ(win: Sample[], palm: number): boolean {
  if (win.filter((s) => isJShape(s.p)).length < win.length * SHAPE_SHARE) return false;
  const xs = smooth(win.map((s) => s.p[TIPS.pinky][0] / palm));
  const ys = smooth(win.map((s) => s.p[TIPS.pinky][1] / palm));
  // Split at the lowest point: before it is the stem (going down), after it is the hook.
  const bottom = ys.indexOf(Math.max(...ys));
  const drop = ys[bottom] - Math.min(...ys.slice(0, bottom + 1));
  const hook = Math.abs(xs[xs.length - 1] - xs[bottom]) + Math.abs(xs[bottom] - xs[Math.max(0, bottom - 2)]);
  let path = 0;
  for (let i = 1; i < xs.length; i++) path += Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
  return drop >= J_MIN_DROP_Y && hook >= J_MIN_HOOK_X && path >= J_MIN_PATH && reversals(xs, Z_TURN) <= 1;
}

export class MotionTracker {
  private buf: Sample[] = [];
  private cooldownUntil = 0;

  /** Feed every camera frame; returns 'J' or 'Z' on the frame a motion letter completes. */
  push(frame: HandFrame): MotionLetter | null {
    if (!frame.points) {
      this.buf = [];
      return null;
    }
    const aspect = frame.aspect ?? 4 / 3;
    this.buf.push({ t: frame.t, p: frame.points.map(([x, y, z]) => [x * aspect, y, z] as Point3) });
    while (this.buf.length && frame.t - this.buf[0].t > WINDOW_MS) this.buf.shift();
    if (frame.t < this.cooldownUntil || this.buf.length < MIN_FRAMES) return null;

    const palms = this.buf.map((s) => dist(s.p[WRIST], s.p[MCPS.middle])).sort((a, b) => a - b);
    const palm = Math.max(palms[palms.length >> 1], 1e-6);
    const found = detectZ(this.buf, palm) ? 'Z' : detectJ(this.buf, palm) ? 'J' : null;
    if (found) {
      this.buf = [];
      this.cooldownUntil = frame.t + COOLDOWN_MS;
    }
    return found;
  }

  reset() {
    this.buf = [];
  }
}

/** Static shapes a motion letter starts from; if one was just typed, the motion letter replaces it. */
export const MOTION_BASE: Record<MotionLetter, string[]> = { J: ['I', 'J'], Z: ['D', 'X', 'G', 'Z', '1'] };
