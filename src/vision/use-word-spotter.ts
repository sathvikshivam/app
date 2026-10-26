import { useCallback, useEffect, useRef, useState } from 'react';

import type { MlpModel } from './mlp';
import type { HandFrame } from './types';
import wordsJson from './words-model.json';
import { dequantize, WordSpotter, type QuantizedModel, type WordResult } from './words';

let model: MlpModel | null = null;
/** Decoded on first use so the letters-only path never pays for it. */
function wordModel() {
  return (model ??= dequantize(wordsJson as unknown as QuantizedModel));
}
export const WORDS = (wordsJson as unknown as QuantizedModel).labels;
export const WORD_METRICS = (wordsJson as unknown as QuantizedModel).metrics;

/** Live word recognition: segments the camera stream into signs and classifies each one. */
export function useWordSpotter({ onWord }: { onWord: (r: WordResult) => void }) {
  const spotter = useRef<WordSpotter | null>(null);
  const [signing, setSigning] = useState(false);
  const [handVisible, setHandVisible] = useState(false);
  const callback = useRef(onWord);
  useEffect(() => {
    callback.current = onWord;
  });

  const onFrame = useCallback((frame: HandFrame) => {
    spotter.current ??= new WordSpotter(wordModel());
    const result = spotter.current.push(frame);
    setSigning(spotter.current.active);
    setHandVisible(!!frame.points);
    if (result) callback.current(result);
  }, []);

  return { onFrame, signing, handVisible };
}
