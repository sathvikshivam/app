import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraPanel } from '@/components/camera-panel';
import { LetterBadge } from '@/components/letter-badge';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Mode } from '@/vision/classifier';
import { initialSpeller, stepSpeller, type SpellerState } from '@/vision/speller';
import { useSignRecognizer } from '@/vision/use-sign-recognizer';
import { useWordSpotter, WORDS } from '@/vision/use-word-spotter';
import type { WordResult } from '@/vision/words';

type TranslateMode = Mode | 'words';

const PLACEHOLDER: Record<TranslateMode, string> = {
  letters: 'Hold a letter steady to type it. Draw J and Z in the air.',
  digits: 'Hold a number steady to type it.',
  words: 'Sign a word, then lower your hands or hold still.',
};

/** Puts a space between the existing text and a new word. */
const appendWord = (text: string, word: string) => (text && !text.endsWith(' ') ? text + ' ' : text) + word + ' ';

export default function TranslateScreen() {
  const theme = useTheme();
  const speller = useRef<SpellerState>(initialSpeller);
  const [text, setText] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [debug, setDebug] = useState(false);
  const [mode, setMode] = useState<TranslateMode>('letters');
  const [lastWord, setLastWord] = useState<WordResult | null>(null);
  const { height } = useWindowDimensions();
  // A fixed camera height (instead of flex) lets the page scroll, so the buttons below are
  // always reachable above the tab bar on smaller phones.
  const cameraHeight = Math.round(Math.min(Math.max(height * 0.46, 260), 520));

  // Feed every smoothed reading through the fingerspelling state machine.
  const { recognition, onFrame } = useSignRecognizer({
    mode: mode === 'words' ? 'letters' : mode,
    onRecognition: (r, t) => {
      const [next, event] = stepSpeller(speller.current, r, t);
      speller.current = next;
      if (event) {
        setText(next.text);
        Haptics.impactAsync(
          event.kind === 'letter' ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium,
        );
      }
    },
  });

  const words = useWordSpotter({
    onWord: (r) => {
      const next = appendWord(speller.current.text, r.word);
      speller.current = { ...speller.current, text: next };
      setText(next);
      setLastWord(r);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  /** "Not it?" chips: swap the last recognized word for one of the runner-up guesses. */
  const replaceLastWord = (word: string) => {
    if (!lastWord) return;
    const suffix = lastWord.word + ' ';
    if (text.endsWith(suffix)) edit(text.slice(0, -suffix.length) + word + ' ');
    setLastWord(null);
  };

  const edit = (newText: string) => {
    speller.current = { ...speller.current, text: newText };
    setText(newText);
  };

  const speak = () => {
    if (!text.trim()) return;
    Speech.stop();
    setSpeaking(true);
    Speech.speak(text.toLowerCase(), { onDone: () => setSpeaking(false), onStopped: () => setSpeaking(false) });
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
            SignBridge
          </Text>
          <Button
            label={debug ? 'Hide' : 'Details'}
            variant="ghost"
            onPress={() => setDebug((d) => !d)}
            accessibilityHint="Shows the model's top guesses"
          />
        </View>
        <View style={styles.modes}>
          <Segmented
            value={mode}
            onChange={(m) => {
              setMode(m);
              setLastWord(null);
            }}
            options={[
              { value: 'letters', label: 'ABC', accessibilityLabel: 'Letters' },
              { value: 'digits', label: '123', accessibilityLabel: 'Numbers' },
              // Words appears once ml/wlasl.py has trained a word model.
              ...(WORDS.length ? [{ value: 'words' as const, label: 'Words', accessibilityLabel: 'Words' }] : []),
            ]}
          />
        </View>

        <CameraPanel
          onFrame={mode === 'words' ? words.onFrame : onFrame}
          handVisible={mode === 'words' ? words.handVisible : recognition.handVisible}
          style={{ height: cameraHeight }}
          showFps={debug}>
          <View style={styles.badge} pointerEvents="none">
            {mode === 'words' ? (
              <View style={styles.wordBadge}>
                <Text style={styles.wordBadgeText}>{words.signing ? 'Signing…' : (lastWord?.word ?? 'Ready')}</Text>
                {!words.signing && lastWord && (
                  <Text style={styles.wordBadgeConf}>{Math.round(lastWord.p * 100)}% sure</Text>
                )}
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
          {debug && mode !== 'words' && recognition.top.length > 0 && (
            <View style={styles.debug} pointerEvents="none">
              {recognition.top.map((t) => (
                <Text key={t.label} style={styles.debugText}>
                  {t.label} {(t.p * 100).toFixed(0)}%
                </Text>
              ))}
            </View>
          )}
        </CameraPanel>

        <View style={[styles.panel, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <ScrollView style={styles.textBox} contentContainerStyle={styles.textBoxContent}>
            <Text
              style={[styles.sentence, { color: text ? theme.text : theme.textSecondary }]}
              accessibilityLiveRegion="polite"
              selectable>
              {text || PLACEHOLDER[mode]}
              {text ? <Text style={{ color: theme.primary }}>▍</Text> : null}
            </Text>
          </ScrollView>

          {mode === 'words' && lastWord && lastWord.top.length > 1 && (
            <View style={[styles.row, styles.wrap]}>
              <Text style={[styles.notIt, { color: theme.textSecondary }]}>Not it?</Text>
              {lastWord.top.slice(1).map((t) => (
                <Button key={t.label} label={t.label} variant="ghost" onPress={() => replaceLastWord(t.label)} />
              ))}
            </View>
          )}
          <View style={styles.row}>
            <Button
              label="Space"
              icon="space"
              onPress={() => edit(text.endsWith(' ') || !text ? text : text + ' ')}
              style={styles.flex}
            />
            <Button label="Delete" icon="delete.left" onPress={() => edit(text.slice(0, -1))} style={styles.flex} />
            <Button label="Clear" icon="xmark" onPress={() => edit('')} style={styles.flex} disabled={!text} />
          </View>
          <View style={styles.row}>
            <Button label="Copy" icon="doc.on.doc" onPress={() => Clipboard.setStringAsync(text)} disabled={!text} />
            <Button
              label={speaking ? 'Speaking…' : 'Speak'}
              icon="speaker.wave.2.fill"
              variant="primary"
              size="lg"
              onPress={speak}
              disabled={!text.trim()}
              style={styles.flex}
              accessibilityHint="Reads the sentence out loud"
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.five },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.two },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  modes: { paddingBottom: Spacing.two },
  wordBadge: {
    backgroundColor: '#000000a6',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  wordBadgeText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  wordBadgeConf: { color: '#ffffffb0', fontSize: 12, fontWeight: '600' },
  notIt: { fontSize: 14, fontWeight: '600', alignSelf: 'center' },
  badge: { position: 'absolute', top: Spacing.three, left: Spacing.three },
  debug: {
    position: 'absolute',
    top: 150,
    left: Spacing.three,
    backgroundColor: '#000000a6',
    borderRadius: Radius.sm,
    padding: Spacing.two,
  },
  debugText: { color: '#fff', fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  panel: {
    marginTop: Spacing.three,
    marginBottom: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  textBox: { maxHeight: 96, minHeight: 56 },
  textBoxContent: { paddingVertical: Spacing.one },
  sentence: { fontSize: 26, fontWeight: '700', letterSpacing: 1 },
  row: { flexDirection: 'row', gap: Spacing.two },
  wrap: { flexWrap: 'wrap' },
  flex: { flex: 1 },
});
