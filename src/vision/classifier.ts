import { forward, type MlpModel } from './mlp';
import modelJson from './model.json';

export type Mode = 'letters' | 'digits';

const model = modelJson as unknown as MlpModel & { modes: Record<Mode, string[]> };
export const LABELS = model.labels;
export const MODEL_METRICS = model.metrics;

// Like a phone keyboard, the user picks ABC or 123 and only that mode's classes compete.
const MODE_MASKS: Record<Mode, boolean[]> = {
  letters: LABELS.map((l) => model.modes.letters.includes(l)),
  digits: LABELS.map((l) => model.modes.digits.includes(l)),
};
export const MODE_LABELS = model.modes;

// Digit/letter pairs that are the same ASL hand shape. The model can't (and shouldn't) choose
// between them, so before masking, each twin's probability is given to the active mode's member.
const TWINS: [string, string][] = [
  ['0', 'O'],
  ['2', 'V'],
  ['6', 'W'],
  ['9', 'F'],
];
const TWIN_INDEX = TWINS.map(([d, l]) => [LABELS.indexOf(d), LABELS.indexOf(l)]).filter(([d, l]) => d >= 0 && l >= 0);

export function classify(features: Float32Array, mode: Mode = 'letters'): Float32Array {
  const probs = forward(model, features);
  for (const [d, l] of TWIN_INDEX) {
    const keep = mode === 'digits' ? d : l;
    probs[keep] = probs[d] + probs[l];
    probs[keep === d ? l : d] = 0;
  }
  const mask = MODE_MASKS[mode];
  let sum = 0;
  for (let i = 0; i < probs.length; i++) sum += mask[i] ? probs[i] : (probs[i] = 0);
  // Renormalize within the mode, but if most of the probability sat on the *other* mode's
  // classes (e.g. an "A" while in 123 mode) keep it low so nothing gets typed.
  const scale = Math.max(sum, 0.5);
  for (let i = 0; i < probs.length; i++) probs[i] /= scale;
  return probs;
}

export function topK(probs: Float32Array, k = 3) {
  return Array.from(probs, (p, i) => ({ label: LABELS[i], p }))
    .sort((a, b) => b.p - a.p)
    .slice(0, k);
}
