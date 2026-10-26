import { useCallback, useEffect, useRef, useState } from 'react';

import { classify, LABELS, topK, type Mode } from './classifier';
import { MotionTracker, type MotionLetter } from './motion';
import { normalize } from './normalize';
import type { HandFrame } from './types';

export type Recognition = {
  /** Smoothed label, or null when there's no hand or the model isn't confident. */
  label: string | null;
  confidence: number;
  /** How long (ms) `label` has been continuously recognized. */
  heldMs: number;
  handVisible: boolean;
  top: { label: string; p: number }[];
  /** Set on the single frame where a drawn J or Z finishes (letters mode only). */
  motion: MotionLetter | null;
};

const EMPTY: Recognition = { label: null, confidence: 0, heldMs: 0, handVisible: false, top: [], motion: null };

// J and Z are drawn in the air, so a single frame of them isn't trustworthy; the motion
// tracker types them instead.
const MOTION_ONLY = LABELS.map((l) => l === 'J' || l === 'Z');

type Options = {
  /** Frames averaged together; bigger = steadier but slower to react. */
  window?: number;
  /** Minimum averaged probability before a label is reported. */
  threshold?: number;
  /** Letters (ABC) or numbers (123): only that mode's signs can be recognized. */
  mode?: Mode;
  /** Called on every frame with the new reading (use this instead of an effect on `recognition`). */
  onRecognition?: (r: Recognition, t: number) => void;
};

/**
 * Turns the raw per-frame stream into a stable reading: classify each frame, average the
 * probabilities over a short sliding window, and only report a label above a confidence
 * threshold. This is what stops the letter from flickering on screen. In letters mode it
 * also runs the J/Z motion tracker over a longer window of the same frames.
 */
export function useSignRecognizer({ window = 6, threshold = 0.6, mode = 'letters', onRecognition }: Options = {}) {
  const [state, setState] = useState<Recognition>(EMPTY);
  const history = useRef<Float32Array[]>([]);
  const since = useRef<{ label: string | null; t: number }>({ label: null, t: 0 });
  const historyMode = useRef(mode);
  const motion = useRef(new MotionTracker());
  const callback = useRef(onRecognition);
  useEffect(() => {
    callback.current = onRecognition;
  });

  const onFrame = useCallback(
    (frame: HandFrame) => {
      const drawn = mode === 'letters' ? motion.current.push(frame) : null;
      if (!frame.points) {
        history.current = [];
        since.current = { label: null, t: frame.t };
        setState(EMPTY);
        callback.current?.(EMPTY, frame.t);
        return;
      }
      if (historyMode.current !== mode) {
        history.current = [];
        historyMode.current = mode;
        motion.current.reset();
      }
      const probs = classify(normalize(frame.points, frame.aspect ?? 4 / 3), mode);
      for (let i = 0; i < probs.length; i++) if (MOTION_ONLY[i]) probs[i] = 0;
      history.current.push(probs);
      if (history.current.length > window) history.current.shift();

      const avg = new Float32Array(LABELS.length);
      for (const p of history.current) for (let i = 0; i < avg.length; i++) avg[i] += p[i] / history.current.length;
      const top = topK(avg, 3);
      const label = top[0].p >= threshold ? top[0].label : null;
      if (label !== since.current.label) since.current = { label, t: frame.t };

      const next = {
        label,
        confidence: top[0].p,
        heldMs: frame.t - since.current.t,
        handVisible: true,
        top,
        motion: drawn,
      };
      setState(next);
      callback.current?.(next, frame.t);
    },
    [window, threshold, mode],
  );

  return { recognition: state, onFrame };
}
