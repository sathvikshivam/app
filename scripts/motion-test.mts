/// <reference types="node" />
/**
 * Tests the J/Z motion tracker on synthetic camera streams built from REAL hand shapes
 * (median training landmarks, scripts/hand-templates.json) moved along drawn paths with noise.
 * Run:  npm run test:motion
 */
import { readFileSync } from 'node:fs';

import { MotionTracker } from '../src/vision/motion.ts';
import type { Point3 } from '../src/vision/types.ts';

const templates: Record<string, Point3[]> = JSON.parse(
  readFileSync(new URL('./hand-templates.json', import.meta.url), 'utf8'),
);
const FPS = 24;
const PALM = 0.12; // palm size as a fraction of the frame height, roughly arm's length on a phone
const ASPECT = 4 / 3;

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

/** A hand of `shape` whose wrist follows `path` (palm units) over `ms`, plus stills before/after. */
function stream(shape: string, path: [number, number][], ms: number, { mirror = false, noise = 0.15 } = {}) {
  const t = templates[shape];
  // Templates come from square images; scale them to PALM and squeeze x into the 4:3 frame.
  const scale = PALM / Math.hypot(t[9][0], t[9][1]);
  const frames: { t: number; points: Point3[]; aspect: number }[] = [];
  const n = Math.round((ms / 1000) * FPS);
  const at = (u: number): [number, number] => {
    const seg = Math.min(path.length - 2, Math.floor(u * (path.length - 1)));
    const k = u * (path.length - 1) - seg;
    return [path[seg][0] + (path[seg + 1][0] - path[seg][0]) * k, path[seg][1] + (path[seg + 1][1] - path[seg][1]) * k];
  };
  const still = Math.round(0.3 * FPS);
  for (let i = -still; i <= n + still; i++) {
    const [px, py] = at(Math.min(1, Math.max(0, i / n)));
    const ox = 0.5 + ((mirror ? -px : px) * PALM) / ASPECT;
    const oy = 0.45 + py * PALM;
    const points = t.map(([x, y, z]) => {
      const jx = rand() * noise * PALM * 0.1;
      const jy = rand() * noise * PALM * 0.1;
      return [ox + ((mirror ? -x : x) * scale) / ASPECT + jx, oy + y * scale + jy, z] as Point3;
    });
    frames.push({ t: 1000 + (i + still) * (1000 / FPS), points, aspect: ASPECT });
  }
  return frames;
}

function run(frames: ReturnType<typeof stream>) {
  const tracker = new MotionTracker();
  const found: string[] = [];
  for (const f of frames) {
    const m = tracker.push(f);
    if (m) found.push(m);
  }
  return found.join('') || '-';
}

const J_PATH: [number, number][] = [[0, 0], [0, 0.6], [0, 1.2], [-0.35, 1.45], [-0.7, 1.3]];
const Z_PATH: [number, number][] = [[0, 0], [1.4, 0], [0, 1.0], [1.4, 1.0]];

const cases: [string, string, ReturnType<typeof stream>][] = [
  ['J drawn', 'J', stream('I', J_PATH, 900)],
  ['J drawn, mirrored camera', 'J', stream('I', J_PATH, 900, { mirror: true })],
  ['J drawn slowly', 'J', stream('I', J_PATH, 1300)],
  ['Z drawn', 'Z', stream('D', Z_PATH, 1100)],
  ['Z drawn, mirrored camera', 'Z', stream('D', Z_PATH, 1100, { mirror: true })],
  ['Z drawn slowly', 'Z', stream('D', Z_PATH, 1300)],
  ['Z drawn small & fast', 'Z', stream('D', Z_PATH.map(([x, y]) => [x * 0.75, y * 0.75] as [number, number]), 700)],
  ['I held still', '-', stream('I', [[0, 0], [0, 0]], 1500)],
  ['I moved straight down (no hook)', '-', stream('I', [[0, 0], [0, 1.4]], 900)],
  ['D held still', '-', stream('D', [[0, 0], [0, 0]], 1500)],
  ['D single swipe right', '-', stream('D', [[0, 0], [1.6, 0.2]], 700)],
  ['D waved left-right 3x', '-', stream('D', [[0, 0], [1.2, 0], [0, 0], [1.2, 0], [0, 0], [1.2, 0], [0, 0]], 1300)],
  ['Open hand (B) drawing a Z', '-', stream('B', Z_PATH, 1100)],
  ['Y hand drawing a J', '-', stream('Y', J_PATH, 900)],
  ['L hand drawing a Z', '-', stream('L', Z_PATH, 1100)],
  ['I jittering a lot', '-', stream('I', [[0, 0], [0, 0]], 1500, { noise: 1.2 })],
];

let fails = 0;
for (const [name, want, frames] of cases) {
  const got = run(frames);
  const ok = got === want;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(34)} expected ${want}  got ${got}`);
}
console.log(fails ? `${fails} motion case(s) failed` : `All ${cases.length} motion cases passed`);
process.exit(fails ? 1 : 0);
