import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Radius, Spacing } from '@/constants/theme';
import { SIGN_MAP } from '@/data/letters';
import { useTheme } from '@/hooks/use-theme';

const STEP_MS = 900;

/** Hearing → Deaf direction: type a message and see it fingerspelled, card by card. */
export default function SpellScreen() {
  const theme = useTheme();
  const [input, setInput] = useState('');
  const [playing, setPlaying] = useState(-1);

  const chars = input.toUpperCase().split('');
  const letters = chars.map((c, i) => ({ c, i })).filter(({ c }) => SIGN_MAP[c]);

  useEffect(() => {
    if (playing < 0) return;
    const id = setTimeout(() => setPlaying((p) => (p + 1 >= letters.length ? -1 : p + 1)), STEP_MS);
    return () => clearTimeout(id);
  }, [playing, letters.length]);

  const current = playing >= 0 ? letters[playing] : null;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
          Text → Sign
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Type a name, word, or number to see how to sign it.
        </Text>

        <TextInput
          value={input}
          onChangeText={(t) => {
            setInput(t);
            setPlaying(-1);
          }}
          placeholder="e.g. Batavia 60510"
          placeholderTextColor={theme.textSecondary}
          autoCorrect={false}
          autoCapitalize="characters"
          maxLength={40}
          accessibilityLabel="Text to fingerspell"
          style={[
            styles.input,
            { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}
        />

        {current && (
          <View
            style={[styles.stage, { backgroundColor: theme.backgroundElement, borderColor: theme.primary }]}
            accessibilityLiveRegion="polite">
            <Image source={SIGN_MAP[current.c].image} style={styles.stageImage} contentFit="contain" />
            <Text style={[styles.stageLetter, { color: theme.primary }]}>{current.c}</Text>
          </View>
        )}

        <Button
          label={playing >= 0 ? 'Stop' : 'Play slowly'}
          icon={playing >= 0 ? 'stop.fill' : 'play.fill'}
          variant="primary"
          size="lg"
          disabled={!letters.length}
          onPress={() => setPlaying((p) => (p >= 0 ? -1 : 0))}
        />

        <View style={styles.grid}>
          {chars.map((c, i) => {
            const info = SIGN_MAP[c];
            if (!info) return <View key={i} style={styles.gap} />;
            const active = current?.i === i;
            return (
              <Pressable
                key={i}
                onPress={() => setPlaying(letters.findIndex((l) => l.i === i))}
                accessibilityRole="button"
                accessibilityLabel={`Letter ${c}. ${info.tip}`}
                style={[styles.card, { borderColor: active ? theme.primary : theme.border, backgroundColor: '#fff' }]}>
                <Image source={info.image} style={styles.cardImage} contentFit="contain" />
                <Text style={styles.cardLetter}>{c}</Text>
                {info.motion && <Text style={styles.motion}>moves</Text>}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, marginTop: -Spacing.two },
  input: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  stage: {
    alignItems: 'center',
    borderRadius: Radius.lg,
    borderWidth: 2,
    padding: Spacing.three,
    backgroundColor: '#fff',
  },
  stageImage: { width: 180, height: 200, backgroundColor: '#fff', borderRadius: Radius.md },
  stageLetter: { fontSize: 44, fontWeight: '800', marginTop: Spacing.two },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  card: { width: 76, alignItems: 'center', borderRadius: Radius.md, borderWidth: 2, padding: Spacing.one },
  cardImage: { width: 64, height: 76 },
  cardLetter: { fontSize: 18, fontWeight: '800', color: '#0E0F1A' },
  motion: { fontSize: 10, fontWeight: '700', color: '#5B5FEF', textTransform: 'uppercase' },
  gap: { width: 24 },
});
