import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CameraPanel } from '@/components/camera-panel';
import { Button } from '@/components/ui/button';
import { Radius, Spacing } from '@/constants/theme';
import { DIGITS, LETTERS } from '@/data/letters';
import { useTheme } from '@/hooks/use-theme';
import { KEYS, load, save } from '@/lib/storage';
import type { HandFrame, Point3 } from '@/vision/types';

type Sample = { label: string; aspect: number; points: Point3[] };

const LABELS = [...LETTERS, ...DIGITS].map((l) => l.letter).concat('SPACE', 'DEL');
const RECORD_MS = 3000;
const EVERY_NTH_FRAME = 2;

/**
 * Records hand landmarks from YOUR camera for each letter, then exports them as JSON for
 * ml/train.py (drop the file in ml/data/my_samples/). Training on your own camera fixes most
 * live-accuracy problems that come from the Kaggle photos looking different from a phone feed.
 */
export default function CollectScreen() {
  const theme = useTheme();
  const [label, setLabel] = useState('A');
  const [samples, setSamples] = useState<Sample[]>([]);
  const [recording, setRecording] = useState(false);
  const [handVisible, setHandVisible] = useState(false);
  const recordUntil = useRef(0);
  const frameCount = useRef(0);
  const labelRef = useRef('A');
  const takeCount = useRef(0);
  const [takeSamples, setTakeSamples] = useState(0);

  useEffect(() => {
    load<Sample[]>(KEYS.samples, []).then(setSamples);
  }, []);

  const onFrame = (f: HandFrame) => {
    setHandVisible(!!f.points);
    if (!recordUntil.current) return;
    if (Date.now() > recordUntil.current) {
      recordUntil.current = 0;
      setRecording(false);
      if (takeCount.current === 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          'No hand seen',
          'Nothing was recorded. Make sure the skeleton is drawn on your hand, then try again.',
        );
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSamples((s) => {
        save(KEYS.samples, s);
        return s;
      });
      return;
    }
    if (f.points && frameCount.current++ % EVERY_NTH_FRAME === 0) {
      const sample = { label: labelRef.current, aspect: f.aspect ?? 4 / 3, points: f.points };
      takeCount.current++;
      setTakeSamples(takeCount.current);
      setSamples((s) => [...s, sample]);
    }
  };

  const start = () => {
    recordUntil.current = Date.now() + RECORD_MS;
    frameCount.current = 0;
    takeCount.current = 0;
    setTakeSamples(0);
    setRecording(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const exportSamples = async () => {
    const json = JSON.stringify(samples);
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
      const file = new File(Paths.cache, `signbridge-samples-${Date.now()}.json`);
      file.create();
      file.write(json);
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' });
    } catch (e) {
      // Fall back to the clipboard so the data is never stuck on the phone.
      await Clipboard.setStringAsync(json);
      Alert.alert(
        'Copied to clipboard instead',
        `Sharing the file failed (${e instanceof Error ? e.message : String(e)}). Paste it into a file named samples.json in ml/data/my_samples/.`,
      );
    }
  };

  const clearAll = () =>
    Alert.alert('Delete all recorded samples?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setSamples([]);
          save(KEYS.samples, []);
        },
      },
    ]);

  const counts = samples.reduce<Record<string, number>>((c, s) => ((c[s.label] = (c[s.label] ?? 0) + 1), c), {});

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.help, { color: theme.textSecondary }]}>
        Pick a letter, make the hand shape, and tap Record. Move your hand around a little while it records (closer,
        farther, slightly tilted). Aim for 3+ recordings per letter.
      </Text>

      <View style={styles.grid}>
        {LABELS.map((l) => (
          <Pressable
            key={l}
            onPress={() => {
              labelRef.current = l;
              setLabel(l);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: l === label }}
            style={[
              styles.chip,
              { backgroundColor: l === label ? theme.primary : theme.backgroundElement, borderColor: theme.border },
            ]}>
            <Text style={[styles.chipLabel, { color: l === label ? theme.onPrimary : theme.text }]}>{l}</Text>
            <Text style={[styles.chipCount, { color: l === label ? theme.onPrimary : theme.textSecondary }]}>
              {counts[l] ?? 0}
            </Text>
          </Pressable>
        ))}
      </View>

      <CameraPanel onFrame={onFrame} handVisible={handVisible} style={styles.camera}>
        {recording && (
          <View style={[styles.rec, { backgroundColor: theme.danger }]} pointerEvents="none">
            <Text style={styles.recText}>
              ● Recording “{label}” · {takeSamples} {handVisible ? '' : '(no hand!)'}
            </Text>
          </View>
        )}
      </CameraPanel>

      <Button
        label={recording ? 'Recording…' : `Record “${label}” for 3 s`}
        icon="record.circle"
        variant="primary"
        size="lg"
        disabled={recording}
        onPress={start}
      />
      <View style={styles.row}>
        <Button
          label={`Export ${samples.length}`}
          icon="square.and.arrow.up"
          onPress={exportSamples}
          disabled={!samples.length || recording}
          style={styles.flex}
        />
        <Button
          label="Delete all"
          icon="trash"
          variant="ghost"
          onPress={clearAll}
          disabled={!samples.length || recording}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  help: { fontSize: 14, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    minWidth: 48,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  chipLabel: { fontSize: 15, fontWeight: '800' },
  chipCount: { fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
  camera: { height: 320 },
  rec: {
    position: 'absolute',
    bottom: Spacing.three,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  recText: { color: '#fff', fontWeight: '700' },
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});
