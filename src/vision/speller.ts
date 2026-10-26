import { MOTION_BASE } from './motion';
import type { Recognition } from './use-sign-recognizer';

export const HOLD_MS = 650;
/** Holding the same letter this long after it was typed types it again (for "LL", "OO"). */
export const REPEAT_MS = 1600;
/** A drawn J/Z replaces the I/D it started from if that was typed this recently. */
const MOTION_REPLACE_MS = 2500;

export type SpellerState = {
  text: string;
  /** Label most recently committed; cleared when the hand drops or changes shape. */
  lastCommitted: string | null;
  committedAt: number;
  /** Last character actually typed, kept even after the hand moves on. */
  lastTyped: string | null;
  typedAt: number;
};

export const initialSpeller: SpellerState = {
  text: '',
  lastCommitted: null,
  committedAt: 0,
  lastTyped: null,
  typedAt: 0,
};

export type SpellerEvent = { kind: 'letter' | 'space' | 'delete'; label: string } | null;

/**
 * Fingerspelling state machine: a letter is typed once it has been held steady for HOLD_MS.
 * To type it again you either change hand shape / drop your hand, or keep holding for REPEAT_MS.
 * The SPACE and DEL hand shapes from the training set act as keyboard gestures.
 */
export function stepSpeller(s: SpellerState, r: Recognition, now: number): [SpellerState, SpellerEvent] {
  if (r.motion) {
    // You start a J from an I (and a Z from a D/1); if that was just typed, swap it out.
    const replace =
      s.lastTyped !== null && MOTION_BASE[r.motion].includes(s.lastTyped) && now - s.typedAt < MOTION_REPLACE_MS;
    const text = (replace ? s.text.slice(0, -1) : s.text) + r.motion;
    return [
      { text, lastCommitted: r.label, committedAt: now, lastTyped: r.motion, typedAt: now },
      { kind: 'letter', label: r.motion },
    ];
  }
  if (!r.label) {
    return [s.lastCommitted ? { ...s, lastCommitted: null } : s, null];
  }
  if (r.label !== s.lastCommitted && s.lastCommitted !== null) {
    s = { ...s, lastCommitted: null };
  }
  const fresh = s.lastCommitted === null && r.heldMs >= HOLD_MS;
  const repeat = s.lastCommitted === r.label && now - s.committedAt >= REPEAT_MS;
  if (!fresh && !repeat) return [s, null];

  const next = { lastCommitted: r.label, committedAt: now, lastTyped: r.label, typedAt: now };
  if (r.label === 'SPACE') {
    return [
      { ...next, text: s.text.endsWith(' ') || !s.text ? s.text : s.text + ' ' },
      { kind: 'space', label: r.label },
    ];
  }
  if (r.label === 'DEL') {
    return [
      { ...next, text: s.text.slice(0, -1) },
      { kind: 'delete', label: r.label },
    ];
  }
  return [
    { ...next, text: s.text + r.label },
    { kind: 'letter', label: r.label },
  ];
}
