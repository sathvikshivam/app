// Explicit .ts extensions so scripts/parity-test.mts can run this file directly in Node.
import { forward, type MlpModel } from './mlp.ts';
import { normalize } from './normalize.ts';
import type { HandFrame, Point3 } from './types';

/**
 * Word-level signs (WLASL prototype). Mirrors ml/sequence_features.py exactly:
 * a clip of 0-2 hands per frame -> stable hand slots -> T resampled frames -> per hand
 * [shape (63), wrist position (2), hand size (1), present flag (1)].
 */
export const T = 12;
const PER_HAND = 63 + 4;
type Hand = Point3[];

const bboxArea = (h: Hand) => {
  const xs = h.map((p) => p[0]);
  const ys = h.map((p) => p[1]);
  return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
};

/** Track each hand across frames by its wrist so "hand 1" stays the same hand. */
export function assignSlots(frames: Hand[][]): (Hand | null)[][] {
  const out: (Hand | null)[][] = [];
  const prev: (Hand | null)[] = [null, null];
  for (const raw of frames) {
    const hands = [...raw].sort((a, b) => bboxArea(b) - bboxArea(a)).slice(0, 2);
    const slots: (Hand | null)[] = [null, null];
    if (!prev[0] && !prev[1]) {
      hands.forEach((h, i) => (slots[i] = h));
    } else {
      for (const h of hands) {
        const cost = (s: number) =>
          prev[s] ? Math.hypot(h[0][0] - prev[s]![0][0], h[0][1] - prev[s]![0][1]) : Infinity;
        const pref = cost(1) < cost(0) ? [1, 0] : [0, 1];
        slots[slots[pref[0]] ? pref[1] : pref[0]] = h;
      }
    }
    for (let s = 0; s < 2; s++) if (slots[s]) prev[s] = slots[s];
    out.push(slots);
  }
  return out;
}

function handFeatures(h: Hand | null, aspect: number, out: Float32Array, at: number) {
  if (!h) return; // stays zero
  out.set(normalize(h, aspect), at);
  const w = h[0];
  out[at + 63] = (w[0] - 0.5) * aspect;
  out[at + 64] = w[1] - 0.5;
  out[at + 65] = Math.hypot((h[9][0] - w[0]) * aspect, h[9][1] - w[1]);
  out[at + 66] = 1;
}

export function sequenceFeatures(frames: Hand[][], aspect: number): Float32Array | null {
  const present = frames.filter((f) => f.length > 0);
  if (present.length < 4) return null;
  const slots = assignSlots(present);
  const out = new Float32Array(T * 2 * PER_HAND);
  for (let k = 0; k < T; k++) {
    const i = Math.round((k * (slots.length - 1)) / (T - 1));
    handFeatures(slots[i][0], aspect, out, (k * 2 + 0) * PER_HAND);
    handFeatures(slots[i][1], aspect, out, (k * 2 + 1) * PER_HAND);
  }
  return out;
}

/** Weights ship as int8 + one scale per layer (4x smaller than float JSON). */
export type QuantizedModel = Omit<MlpModel, 'layers'> & {
  layers: { q: string; scale: number; shape: [number, number]; b: number[] }[];
  metrics?: { top1: number; top3: number; testClips: number };
};

export function dequantize(m: QuantizedModel): MlpModel {
  return {
    ...m,
    metrics: undefined,
    layers: m.layers.map(({ q, scale, shape: [rows, cols], b }) => {
      const bytes = Uint8Array.from(atob(q), (c) => c.charCodeAt(0));
      const W: number[][] = [];
      for (let i = 0; i < rows; i++) {
        const row = new Array<number>(cols);
        for (let j = 0; j < cols; j++) {
          const v = bytes[i * cols + j];
          row[j] = (v > 127 ? v - 256 : v) * scale;
        }
        W.push(row);
      }
      return { W, b };
    }),
  };
}

export type WordResult = { word: string; p: number; top: { label: string; p: number }[] };

export function classifyWord(model: MlpModel, frames: Hand[][], aspect: number): WordResult | null {
  const f = sequenceFeatures(frames, aspect);
  if (!f) return null;
  const probs = forward(model, f);
  const top = Array.from(probs, (p, i) => ({ label: model.labels[i], p }))
    .sort((a, b) => b.p - a.p)
    .slice(0, 3);
  return { word: top[0].label, p: top[0].p, top };
}

const START_FRAMES = 3; // hands visible this many frames in a row = a sign has started
const END_GONE_FRAMES = 6; // hands gone this long = the sign is over
const END_STILL_MS = 700; // ...or hands held still this long after moving
const STILL_SPEED = 0.25; // palm units per second
const MIN_SIGN_MS = 400;
const MAX_SIGN_MS = 4000;

/** Speed of the biggest hand's wrist between two frames, in palm units per second. */
function wristSpeed(a: { t: number; hands: Hand[] }, b: { t: number; hands: Hand[] }, aspect: number) {
  const h = b.hands[0];
  const palm = Math.max(Math.hypot((h[9][0] - h[0][0]) * aspect, h[9][1] - h[0][1]), 1e-6);
  const dt = Math.max(b.t - a.t, 1) / 1000;
  return Math.hypot((h[0][0] - a.hands[0][0][0]) * aspect, h[0][1] - a.hands[0][0][1]) / palm / dt;
}

/**
 * Cuts the live camera stream into one clip per sign: a sign starts when hands appear and ends
 * when they drop out of view or stop moving. Each finished clip is classified once.
 */
export class WordSpotter {
  private clip: { t: number; hands: Hand[] }[] = [];
  private seen = 0;
  private gone = 0;
  private stillSince: number | null = null;
  private moved = false;
  /** After a sign, wait for the hands to drop or move again so a resting hand isn't a new sign. */
  private waitForRelease = false;
  private lastIdle: { t: number; hands: Hand[] } | null = null;

  private model: MlpModel;
  private minConfidence: number;

  constructor(model: MlpModel, minConfidence = 0.35) {
    this.model = model;
    this.minConfidence = minConfidence;
  }

  get active() {
    return this.clip.length > 0;
  }

  /** Returns a result on the frame a sign finishes, otherwise null. */
  push(frame: HandFrame): WordResult | null {
    const hands = (frame.hands ?? []).map((h) => h.points);
    const aspect = frame.aspect ?? 4 / 3;
    if (!this.active) {
      if (this.waitForRelease) {
        const last = this.lastIdle;
        this.lastIdle = { t: frame.t, hands };
        if (!hands.length) this.waitForRelease = false;
        else if (last?.hands.length && wristSpeed(last, { t: frame.t, hands }, aspect) > STILL_SPEED * 3) {
          this.waitForRelease = false;
        }
        if (this.waitForRelease) return null;
      }
      this.seen = hands.length ? this.seen + 1 : 0;
      if (this.seen < START_FRAMES) return null;
      this.reset();
    }
    this.clip.push({ t: frame.t, hands });
    this.gone = hands.length ? 0 : this.gone + 1;

    // Track whether the hands have moved and, after that, stopped.
    const prev = this.clip[this.clip.length - 2];
    if (prev && hands.length && prev.hands.length) {
      const speed = wristSpeed(prev, { t: frame.t, hands }, aspect);
      if (speed > STILL_SPEED * 3) this.moved = true;
      this.stillSince = speed < STILL_SPEED ? (this.stillSince ?? frame.t) : null;
    }

    const duration = frame.t - this.clip[0].t;
    const ended =
      this.gone >= END_GONE_FRAMES ||
      (this.moved && this.stillSince !== null && frame.t - this.stillSince >= END_STILL_MS) ||
      duration >= MAX_SIGN_MS;
    if (!ended) return null;

    const frames = this.clip.map((c) => c.hands);
    const moved = this.moved;
    this.reset();
    this.seen = 0;
    this.waitForRelease = true;
    this.lastIdle = { t: frame.t, hands };
    if (duration < MIN_SIGN_MS || !moved) return null;
    const result = classifyWord(this.model, frames, aspect);
    return result && result.p >= this.minConfidence ? result : null;
  }

  reset() {
    this.clip = [];
    this.gone = 0;
    this.stillSince = null;
    this.moved = false;
  }
}
