/// <reference types="node" />
/**
 * Checks that the app's TypeScript feature pipelines + classifiers produce the same numbers as
 * the Python training code, for both the letter/number model and the word model.
 * Run after every retrain:  npm run test:parity
 */
import { readFileSync } from 'node:fs';

import { forward, type MlpModel } from '../src/vision/mlp.ts';
import { normalize } from '../src/vision/normalize.ts';
import type { Point3 } from '../src/vision/types.ts';
import { dequantize, sequenceFeatures, type QuantizedModel } from '../src/vision/words.ts';

const dir = new URL('../src/vision/', import.meta.url);
const read = (name: string) => JSON.parse(readFileSync(new URL(name, dir), 'utf8'));

function compare(name: string, cases: { features: number[]; probs: number[] }[], run: (i: number) => [ArrayLike<number>, ArrayLike<number>]) {
  let worstFeature = 0;
  let worstProb = 0;
  cases.forEach((c, i) => {
    const [f, p] = run(i);
    c.features.forEach((v, j) => (worstFeature = Math.max(worstFeature, Math.abs(v - f[j]))));
    c.probs.forEach((v, j) => (worstProb = Math.max(worstProb, Math.abs(v - p[j]))));
  });
  console.log(
    `${name}: ${cases.length} samples | max feature diff ${worstFeature.toExponential(2)} | max prob diff ${worstProb.toExponential(2)}`,
  );
  // Python rounds the stored points/weights, so allow small float error.
  return worstFeature <= 1e-3 && worstProb <= 1e-2;
}

const letters: MlpModel = read('model.json');
const letterCases: { aspect: number; points: Point3[]; features: number[]; probs: number[] }[] = read('parity-fixture.json');
let ok = compare('letters/numbers', letterCases, (i) => {
  const f = normalize(letterCases[i].points, letterCases[i].aspect);
  return [f, forward(letters, f)];
});

const words = dequantize(read('words-model.json') as QuantizedModel);
const wordCases: { aspect: number; frames: Point3[][][]; features: number[]; probs: number[] }[] =
  read('words-parity-fixture.json');
ok =
  compare('words', wordCases, (i) => {
    const f = sequenceFeatures(wordCases[i].frames, wordCases[i].aspect)!;
    return [f, forward(words, f)];
  }) && ok;

if (!ok) {
  console.error('PARITY FAILED: app and training code disagree');
  process.exit(1);
}
console.log('Parity OK');
