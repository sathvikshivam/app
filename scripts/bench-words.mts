/// <reference types="node" />
/**
 * How expensive is the word model on a phone? Measures decode time, per-sign inference time
 * (features + forward pass) and model size. Phones run JS roughly 2-4x slower than a laptop.
 * Run:  npm run bench:words
 */
import { readFileSync, statSync } from 'node:fs';

import { forward } from '../src/vision/mlp.ts';
import { dequantize, sequenceFeatures, type QuantizedModel } from '../src/vision/words.ts';

const dir = new URL('../src/vision/', import.meta.url);
const raw = JSON.parse(readFileSync(new URL('words-model.json', dir), 'utf8')) as QuantizedModel;
const clips = JSON.parse(readFileSync(new URL('words-parity-fixture.json', dir), 'utf8'));

let t = performance.now();
const model = dequantize(raw);
const decodeMs = performance.now() - t;

const runs = 200;
t = performance.now();
for (let i = 0; i < runs; i++) {
  const c = clips[i % clips.length];
  forward(model, sequenceFeatures(c.frames, c.aspect)!);
}
const inferMs = (performance.now() - t) / runs;

const kb = statSync(new URL('words-model.json', dir)).size / 1024;
console.log(`words: ${raw.labels.length} | model file ${kb.toFixed(0)} KB | decode ${decodeMs.toFixed(1)} ms (once)`);
console.log(
  `inference per sign ${inferMs.toFixed(2)} ms on this machine (~${(inferMs * 4).toFixed(1)} ms worst case on a phone)`,
);
