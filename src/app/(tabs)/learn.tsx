import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraPanel } from '@/components/camera-panel';
import { LetterBadge } from '@/components/letter-badge';
import { SignAnimation } from '@/components/sign-animation';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Radius, Spacing } from '@/constants/theme';
import { DIGITS, LETTERS, SIGN_MAP } from '@/data/letters';
import { useTheme } from '@/hooks/use-theme';
import { KEYS, load, save } from '@/lib/storage';
import { LABELS, type Mode } from '@/vision/classifier';
import { useSignRecognizer } from '@/vision/use-sign-recognizer';
import { useWordSpotter, WORDS } from '@/vision/use-word-spotter';
import type { WordResult } from '@/vision/words';

const SUCCESS_HOLD_MS = 450;
const GIVE_UP_MS = 12000;

type LearnMode = Mode | 'words';
type StatEntry = { tries: number; wins: number };
type Progress = { stats: Record<string, StatEntry>; best: number };

// Only practice signs the models actually know.
const POOLS: Record<LearnMode, string[]> = {
  letters: LETTERS.filter((l) => LABELS.includes(l.letter)).map((l) => l.letter),
  digits: DIGITS.filter((l) => LABELS.includes(l.letter)).map((l) => l.letter),
  words: WORDS,
};
const NOUN: Record<LearnMode, string> = { letters: 'letter', digits: 'number', words: 'word' };

/** Weighted pick: signs you miss more often come up more often. */
function pickNext(mode: LearnMode, stats: Record<string, StatEntry>, avoid?: string) {
  const POOL = POOLS[mode];
  const weights = POOL.map((l) => {
    const s = stats[l] ?? { tries: 0, wins: 0 };
    const missRate = s.tries ? 1 - s.wins / s.tries : 0.6;
    return l === avoid ? 0 : 0.25 + missRate;
  });
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < POOL.length; i++) if ((r -= weights[i]) <= 0) return POOL[i];
  return POOL[0];
}

export default function LearnScreen() {
  const theme = useTheme();
  const [progress, setProgress] = useState<Progress>({ stats: {}, best: 0 });
  const [mode, setMode] = useState<LearnMode>('letters');
  const [target, setTarget] = useState(() => pickNext('letters', {}));
  const [streak, setStreak] = useState(0);
  const [showHint, setShowHint] = useState(true);
  const [result, setResult] = useState<'idle' | 'success'>('idle');
  const [stuck, setStuck] = useState(false);
  const [lastGuess, setLastGuess] = useState<WordResult | null>(null);
  // Frames can arrive before React re-renders, so guard the success transition with a ref.
  const solved = useRef(false);
  // "Practice" in the dictionary opens this tab with ?word=...
  const { word: wordParam } = useLocalSearchParams<{ word?: string }>();

  useEffect(() => {
    load<Progress>(KEYS.progress, { stats: {}, best: 0 }).then((p) => {
      setProgress(p);
      setTarget((t) => (POOLS.letters.includes(t) ? pickNext('letters', p.stats) : t));
    });
  }, []);

  // Offer "Try another" if a sign takes too long.
  useEffect(() => {
    const id = setTimeout(() => setStuck(true), GIVE_UP_MS);
    return () => clearTimeout(id);
  }, [target]);

  const record = (sign: string, won: boolean, newStreak: number) => {
    setProgress((p) => {
      const s = p.stats[sign] ?? { tries: 0, wins: 0 };
      const next = {
        stats: { ...p.stats, [sign]: { tries: s.tries + 1, wins: s.wins + (won ? 1 : 0) } },
        best: Math.max(p.best, newStreak),
      };
      save(KEYS.progress, next);
      return next;
    });
  };

  const switchMode = (m: LearnMode, next?: string) => {
    setMode(m);
    setStreak(0);
    solved.current = false;
    setResult('idle');
    setStuck(false);
    setLastGuess(null);
    setTarget(next ?? pickNext(m, progress.stats));
  };

  // Opened from the dictionary: jump straight to that word.
  const [handledParam, setHandledParam] = useState<string | undefined>();
  if (wordParam && wordParam !== handledParam && WORDS.includes(wordParam)) {
    setHandledParam(wordParam);
    switchMode('words', wordParam);
  }

  const advance = (stats: Record<string, StatEntry>) => {
    solved.current = false;
    setResult('idle');
    setStuck(false);
    setLastGuess(null);
    setTarget((t) => pickNext(mode, stats, t));
  };

  const succeed = () => {
    if (solved.current) return;
    solved.current = true;
    const newStreak = streak + 1;
    setStreak(newStreak);
    setResult('success');
    record(target, true, newStreak);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => advance(progress.stats), 900);
  };

  // Letters and numbers: the target recognized and held briefly (J and Z: drawn in the air).
  const { recognition, onFrame } = useSignRecognizer({
    mode: mode === 'words' ? 'letters' : mode,
    onRecognition: (r) => {
      if (mode === 'words') return;
      const hit = SIGN_MAP[target]?.motion ? r.motion === target : r.label === target && r.heldMs >= SUCCESS_HOLD_MS;
      if (hit) succeed();
    },
  });

  // Words: counts if the target is among the model's top three guesses (word models are less sure).
  const words = useWordSpotter({
    onWord: (r) => {
      setLastGuess(r);
      if (r.top.some((t) => t.label === target)) succeed();
      else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    },
  });

  const skip = () => {
    record(target, false, 0);
    setStreak(0);
    advance(progress.stats);
  };

  const info = mode === 'words' ? null : SIGN_MAP[target];
  const POOL = POOLS[mode];
  const mastered = POOL.filter((l) => {
    const s = progress.stats[l];
    return s && s.wins >= 3 && s.wins / s.tries >= 0.7;
  }).length;
  const tip =
    result === 'success'
      ? 'Nice! ✓'
      : info
        ? info.tip
        : lastGuess
          ? `That looked like “${lastGuess.word}”. Watch the animation and try again.`
          : 'Copy the animation, then lower your hands or hold still.';

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
            Practice
          </Text>
          <Segmented
            value={mode}
            onChange={(m) => switchMode(m)}
            options={[
              { value: 'letters', label: 'ABC', accessibilityLabel: 'Practice letters' },
              { value: 'digits', label: '123', accessibilityLabel: 'Practice numbers' },
              ...(WORDS.length
                ? [{ value: 'words' as const, label: 'Words', accessibilityLabel: 'Practice words' }]
                : []),
            ]}
          />
          <View style={styles.stats}>
            <Stat label="Streak" value={streak} />
            <Stat label="Best" value={progress.best} />
            <Stat label="Mastered" value={`${mastered}/${POOL.length}`} />
          </View>
        </View>

        <View
          style={[
            styles.targetCard,
            {
              backgroundColor: result === 'success' ? theme.successSoft : theme.backgroundElement,
              borderColor: result === 'success' ? theme.success : theme.border,
            },
          ]}>
          <View style={styles.targetText}>
            <Text style={[styles.prompt, { color: theme.textSecondary }]}>Sign the {NOUN[mode]}</Text>
            <Text
              style={[
                mode === 'words' ? styles.targetWord : styles.targetLetter,
                { color: result === 'success' ? theme.success : theme.text },
              ]}
              adjustsFontSizeToFit
              numberOfLines={1}
              accessibilityLabel={`Target ${NOUN[mode]} ${target}`}>
              {target}
            </Text>
            <Text style={[styles.tip, { color: theme.textSecondary }]}>{tip}</Text>
          </View>
          {showHint && mode === 'words' && <SignAnimation key={target} word={target} size={120} speed={0.7} />}
          {showHint && info && (
            <View style={styles.hintImageWrap}>
              <Image
                source={info.image}
                style={styles.hintImage}
                contentFit="contain"
                accessibilityLabel={`Hand shape for ${target}`}
              />
            </View>
          )}
        </View>

        <CameraPanel
          onFrame={mode === 'words' ? words.onFrame : onFrame}
          handVisible={mode === 'words' ? words.handVisible : recognition.handVisible}
          style={styles.camera}>
          <View style={styles.badge} pointerEvents="none">
            {mode === 'words' ? (
              <View style={styles.wordBadge}>
                <Text style={styles.wordBadgeText}>{words.signing ? 'Signing…' : 'Ready'}</Text>
              </View>
            ) : (
              <LetterBadge
                label={recognition.label}
                heldMs={recognition.heldMs}
                confidence={recognition.confidence}
                color={theme.success}
              />
            )}
          </View>
        </CameraPanel>

        <View style={styles.row}>
          <Button
            label={showHint ? (mode === 'words' ? 'Hide animation' : 'Hide picture') : 'Show hint'}
            icon={showHint ? 'eye.slash' : 'eye'}
            onPress={() => setShowHint((h) => !h)}
            style={styles.flex}
          />
          <Button label={stuck ? 'Try another' : 'Skip'} icon="forward.fill" onPress={skip} style={styles.flex} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  const theme = useTheme();
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.five },
  header: { gap: Spacing.two },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  stats: { flexDirection: 'row', gap: Spacing.four },
  statValue: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  targetCard: {
    flexDirection: 'row',
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    padding: Spacing.three,
    gap: Spacing.three,
    alignItems: 'center',
  },
  targetText: { flex: 1 },
  prompt: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  targetLetter: { fontSize: 72, lineHeight: 80, fontWeight: '800' },
  targetWord: { fontSize: 40, lineHeight: 48, fontWeight: '800' },
  tip: { fontSize: 15, lineHeight: 21 },
  hintImageWrap: { width: 96, height: 120, backgroundColor: '#fff', borderRadius: Radius.md, padding: Spacing.two },
  hintImage: { flex: 1 },
  camera: { height: 340 },
  badge: { position: 'absolute', top: Spacing.three, left: Spacing.three },
  wordBadge: {
    backgroundColor: '#000000a6',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  wordBadgeText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});
