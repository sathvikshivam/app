import dictionary from '@/vision/words-dictionary.json';

/**
 * Word sign animations exported by ml/wlasl.py: for each word, one representative WLASL clip
 * as `frames` keyframes x 2 hands x 21 (x, y) points, quantized to bytes and base64-encoded.
 * Per frame: [present0, 42 bytes hand0, present1, 42 bytes hand1]. Coordinates are 0..254 in a
 * square box around the whole clip, so the hands' movement through space is preserved.
 */
type Dictionary = { frames: number; words: string[]; clips: string[] };
const dict = dictionary as Dictionary;

export type HandPose = [number, number][] | null;
/** One keyframe: [hand 1, hand 2], each 21 points in 0..1, or null when that hand isn't visible. */
export type SignFrame = [HandPose, HandPose];

export const DICTIONARY_WORDS = dict.words;
const indexOf = new Map(dict.words.map((w, i) => [w, i]));
const cache = new Map<string, SignFrame[]>();

export function hasSignAnimation(word: string) {
  return indexOf.has(word);
}

export function signAnimation(word: string): SignFrame[] | null {
  const i = indexOf.get(word);
  if (i === undefined) return null;
  const hit = cache.get(word);
  if (hit) return hit;
  const bytes = Uint8Array.from(atob(dict.clips[i]), (c) => c.charCodeAt(0));
  const frames: SignFrame[] = [];
  for (let f = 0; f < dict.frames; f++) {
    const hands = [0, 1].map((h) => {
      const at = (f * 2 + h) * 43;
      if (!bytes[at]) return null;
      const pts: [number, number][] = [];
      for (let p = 0; p < 21; p++) pts.push([bytes[at + 1 + p * 2] / 254, bytes[at + 2 + p * 2] / 254]);
      return pts;
    });
    frames.push([hands[0], hands[1]]);
  }
  cache.set(word, frames);
  return frames;
}
