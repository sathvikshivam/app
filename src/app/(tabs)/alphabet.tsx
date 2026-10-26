import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState, type ReactNode } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SignAnimation } from '@/components/sign-animation';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Radius, Spacing } from '@/constants/theme';
import { DIGITS, LETTERS, type Letter } from '@/data/letters';
import { DICTIONARY_WORDS } from '@/data/word-dictionary';
import { useTheme } from '@/hooks/use-theme';
import { MODEL_METRICS } from '@/vision/classifier';
import { WORD_METRICS, WORDS } from '@/vision/use-word-spotter';

type Section = 'letters' | 'digits' | 'words';

export default function DictionaryScreen() {
  const theme = useTheme();
  const [section, setSection] = useState<Section>('letters');

  const header = (
    <View style={styles.header}>
      <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
        Dictionary
      </Text>
      <Segmented
        value={section}
        onChange={setSection}
        options={[
          { value: 'letters', label: 'ABC', accessibilityLabel: 'Letters' },
          { value: 'digits', label: '123', accessibilityLabel: 'Numbers' },
          ...(DICTIONARY_WORDS.length ? [{ value: 'words' as const, label: 'Words' }] : []),
        ]}
      />
    </View>
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]} edges={['top']}>
      {section === 'words' ? (
        <WordsDictionary header={header} />
      ) : (
        <HandShapes header={header} items={section === 'letters' ? LETTERS : DIGITS} key={section} />
      )}
    </SafeAreaView>
  );
}

function HandShapes({ header, items }: { header: ReactNode; items: Letter[] }) {
  const theme = useTheme();
  const [selected, setSelected] = useState<Letter>(items[0]);
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      {header}
      <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <View style={styles.detailImageWrap}>
          <Image
            source={selected.image}
            style={styles.detailImage}
            contentFit="contain"
            accessibilityLabel={`Hand shape for ${selected.letter}`}
          />
        </View>
        <View style={styles.detailText}>
          <Text style={[styles.detailLetter, { color: theme.text }]}>{selected.letter}</Text>
          <Text style={[styles.detailTip, { color: theme.textSecondary }]}>{selected.tip}</Text>
          {selected.motion && (
            <Text style={[styles.badge, { color: theme.primary, backgroundColor: theme.primarySoft }]}>
              Draw it in the air
            </Text>
          )}
        </View>
      </View>

      <View style={styles.grid}>
        {items.map((l) => {
          const active = l.letter === selected.letter;
          return (
            <Pressable
              key={l.letter}
              onPress={() => setSelected(l)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={l.letter}
              style={[styles.cell, { borderColor: active ? theme.primary : 'transparent' }]}>
              <Image source={l.image} style={styles.cellImage} contentFit="contain" />
              <Text style={styles.cellLetter}>{l.letter}</Text>
            </Pressable>
          );
        })}
      </View>

      <About />
    </ScrollView>
  );
}

function WordsDictionary({ header }: { header: ReactNode }) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(DICTIONARY_WORDS[0]);
  const [slow, setSlow] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DICTIONARY_WORDS;
    const starts = DICTIONARY_WORDS.filter((w) => w.startsWith(q));
    const contains = DICTIONARY_WORDS.filter((w) => !w.startsWith(q) && w.includes(q));
    return [...starts, ...contains];
  }, [query]);

  return (
    <FlatList
      data={results}
      keyExtractor={(w) => w}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.listContent}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      initialNumToRender={20}
      ListHeaderComponent={
        <View style={styles.wordsHeader}>
          {header}
          <View style={[styles.wordCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <SignAnimation key={selected} word={selected} size={220} speed={slow ? 0.5 : 1} />
            <View style={styles.wordInfo}>
              <Text style={[styles.wordTitle, { color: theme.text }]}>{selected}</Text>
              <Text style={[styles.detailTip, styles.center, { color: theme.textSecondary }]}>
                As seen facing the signer. Purple dots are one hand, green the other.
              </Text>
              <View style={styles.row}>
                <Button
                  label={slow ? 'Normal speed' : 'Slow down'}
                  icon={slow ? 'hare' : 'tortoise'}
                  onPress={() => setSlow((s) => !s)}
                  style={styles.flex}
                />
                <Button
                  label="Practice"
                  icon="graduationcap"
                  onPress={() => router.navigate({ pathname: '/learn', params: { word: selected } })}
                  style={styles.flex}
                />
              </View>
              <Button
                label="Watch a real signer"
                icon="play.rectangle"
                variant="ghost"
                onPress={() =>
                  WebBrowser.openBrowserAsync(`https://www.signasl.org/sign/${encodeURIComponent(selected)}`)
                }
                accessibilityHint="Opens SignASL.org videos for this word"
              />
            </View>
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={`Search ${DICTIONARY_WORDS.length.toLocaleString()} words`}
            placeholderTextColor={theme.textSecondary}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            accessibilityLabel="Search words"
            style={[
              styles.search,
              { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}
          />
        </View>
      }
      ListEmptyComponent={<Text style={[styles.detailTip, { color: theme.textSecondary }]}>No words match.</Text>}
      renderItem={({ item }) => {
        const active = item === selected;
        return (
          <Pressable
            onPress={() => setSelected(item)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.wordRow,
              { borderColor: theme.border, backgroundColor: active ? theme.primarySoft : 'transparent' },
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.wordRowText, { color: active ? theme.primary : theme.text }]}>{item}</Text>
          </Pressable>
        );
      }}
      ListFooterComponent={
        <View style={styles.footer}>
          <About />
        </View>
      }
    />
  );
}

function About() {
  const theme = useTheme();
  const letters = MODEL_METRICS
    ? `letters ${Math.round(MODEL_METRICS.heldOutAccuracy * 1000) / 10}% on held-out test data`
    : null;
  const words =
    WORD_METRICS && WORDS.length
      ? `${WORDS.length.toLocaleString()} words ${Math.round(WORD_METRICS.top1 * 100)}% on the first guess, ${Math.round(WORD_METRICS.top3 * 100)}% within three`
      : null;
  const metrics = [letters, words].filter(Boolean).join('; ');
  return (
    <View style={[styles.about, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <Text style={[styles.aboutTitle, { color: theme.text }]}>How SignBridge works</Text>
      <Text style={[styles.aboutText, { color: theme.textSecondary }]}>
        Your camera feed never leaves your phone. MediaPipe finds 21 points on each hand, and neural networks trained
        for SignBridge read them{metrics ? ` (${metrics})` : ''}.
      </Text>
      <Text style={[styles.aboutText, { color: theme.textSecondary }]}>
        ASL is a full language with its own grammar, facial expressions, and movement. SignBridge covers fingerspelling,
        numbers, and individual word signs: a starting point, not a translator for full sentences.
      </Text>
      <Button
        label="Record your own training data"
        icon="record.circle"
        variant="ghost"
        onPress={() => router.push('/collect')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  listContent: { padding: Spacing.three, paddingBottom: Spacing.six },
  header: { gap: Spacing.two },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  card: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  detailImageWrap: { width: 120, height: 150, backgroundColor: '#fff', borderRadius: Radius.md, padding: Spacing.two },
  detailImage: { flex: 1 },
  detailText: { flex: 1, gap: Spacing.one },
  detailLetter: { fontSize: 48, fontWeight: '800', lineHeight: 54 },
  detailTip: { fontSize: 15, lineHeight: 21 },
  center: { textAlign: 'center' },
  badge: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    overflow: 'hidden',
    marginTop: Spacing.one,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, justifyContent: 'space-between' },
  cell: {
    width: '23%',
    aspectRatio: 0.8,
    backgroundColor: '#fff',
    borderRadius: Radius.md,
    borderWidth: 2,
    alignItems: 'center',
    padding: Spacing.one,
  },
  cellImage: { flex: 1, width: '100%' },
  cellLetter: { fontSize: 16, fontWeight: '800', color: '#0E0F1A' },
  wordsHeader: { gap: Spacing.three, marginBottom: Spacing.three },
  wordCard: {
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  wordInfo: { alignSelf: 'stretch', gap: Spacing.two },
  wordTitle: { fontSize: 32, fontWeight: '800', textAlign: 'center' },
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
  search: {
    fontSize: 17,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  wordRow: {
    paddingVertical: 14,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.6 },
  wordRowText: { fontSize: 17, fontWeight: '600' },
  footer: { marginTop: Spacing.three },
  about: { padding: Spacing.three, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, gap: Spacing.two },
  aboutTitle: { fontSize: 17, fontWeight: '700' },
  aboutText: { fontSize: 14, lineHeight: 20 },
});
