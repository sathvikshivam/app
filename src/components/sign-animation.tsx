import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { Radius } from '@/constants/theme';
import { signAnimation, type HandPose, type SignFrame } from '@/data/word-dictionary';
import { useTheme } from '@/hooks/use-theme';

const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11],
  [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
] as const; // prettier-ignore
const TIPS = [4, 8, 12, 16, 20];
const FPS = 30;
const HOLD_END_MS = 600;

/** Blend two poses; if a hand is only in one of them, show that one. */
function lerpPose(a: HandPose, b: HandPose, k: number): HandPose {
  if (!a || !b) return k < 0.5 ? a : b;
  return a.map(([x, y], i) => [x + (b[i][0] - x) * k, y + (b[i][1] - y) * k]);
}

/**
 * Plays a word's sign as two animated hand skeletons, as seen when facing the signer.
 * `speed` 1 = the recorded pace (about 1.5 s per sign).
 */
export function SignAnimation({ word, size = 240, speed = 1 }: { word: string; size?: number; speed?: number }) {
  const theme = useTheme();
  const frames = signAnimation(word);
  const [t, setT] = useState(0);

  useEffect(() => {
    if (!frames) return;
    const loopMs = (frames.length * 125) / speed + HOLD_END_MS;
    const start = Date.now();
    const id = setInterval(() => setT(((Date.now() - start) % loopMs) / (loopMs - HOLD_END_MS)), 1000 / FPS);
    return () => clearInterval(id);
  }, [frames, speed]);

  if (!frames) {
    return (
      <View style={[styles.box, { width: size, height: size, backgroundColor: theme.backgroundSelected }]}>
        <Text style={{ color: theme.textSecondary }}>No animation for this word</Text>
      </View>
    );
  }

  const pos = Math.min(t, 1) * (frames.length - 1);
  const i = Math.floor(pos);
  const frame: SignFrame = [
    lerpPose(frames[i][0], frames[Math.min(i + 1, frames.length - 1)][0], pos - i),
    lerpPose(frames[i][1], frames[Math.min(i + 1, frames.length - 1)][1], pos - i),
  ];
  const pad = size * 0.08;
  const scale = size - pad * 2;
  const colors = [theme.primary, theme.success];

  return (
    <View
      style={[styles.box, { width: size, height: size, backgroundColor: theme.backgroundSelected }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Animated hands signing ${word}`}>
      <Svg width={size} height={size}>
        {frame.map((hand, h) =>
          hand ? <HandSkeleton key={h} pose={hand} color={colors[h]} pad={pad} scale={scale} ink={theme.text} /> : null,
        )}
      </Svg>
    </View>
  );
}

function HandSkeleton({
  pose,
  color,
  pad,
  scale,
  ink,
}: {
  pose: [number, number][];
  color: string;
  pad: number;
  scale: number;
  ink: string;
}) {
  const P = pose.map(([x, y]) => [pad + x * scale, pad + y * scale]);
  return (
    <>
      {BONES.map(([a, b]) => (
        <Line
          key={`${a}-${b}`}
          x1={P[a][0]}
          y1={P[a][1]}
          x2={P[b][0]}
          y2={P[b][1]}
          stroke={ink}
          strokeWidth={4}
          strokeLinecap="round"
        />
      ))}
      {TIPS.map((t) => (
        <Circle key={t} cx={P[t][0]} cy={P[t][1]} r={5} fill={color} />
      ))}
      <Circle cx={P[0][0]} cy={P[0][1]} r={6} fill={color} />
    </>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
