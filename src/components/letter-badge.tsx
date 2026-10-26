import { StyleSheet, Text, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { HOLD_MS } from '@/vision/speller';

type Props = {
  label: string | null;
  heldMs: number;
  confidence: number;
  color: string;
};

const DISPLAY: Record<string, string> = { SPACE: '␣', DEL: '⌫' };

/** The big live letter over the camera, with a bar that fills while you hold the sign. */
export function LetterBadge({ label, heldMs, confidence, color }: Props) {
  const progress = label ? Math.min(1, heldMs / HOLD_MS) : 0;
  return (
    <View
      style={styles.badge}
      accessible
      accessibilityLabel={label ? `Seeing ${label}, ${Math.round(confidence * 100)} percent sure` : 'No letter yet'}>
      <Text style={styles.letter}>{label ? (DISPLAY[label] ?? label) : '–'}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.conf}>{label ? `${Math.round(confidence * 100)}%` : ' '}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 104,
    paddingVertical: 10,
    borderRadius: Radius.lg,
    backgroundColor: '#000000a6',
    alignItems: 'center',
  },
  letter: { color: '#fff', fontSize: 56, lineHeight: 64, fontWeight: '800' },
  track: { width: 64, height: 5, borderRadius: 3, backgroundColor: '#ffffff33', overflow: 'hidden', marginTop: 2 },
  fill: { height: 5, borderRadius: 3 },
  conf: { color: '#ffffffb0', fontSize: 12, fontWeight: '600', marginTop: 4 },
});
