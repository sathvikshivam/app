import { useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { VisionEngine } from '@/vision/vision-engine';
import type { EngineStatus, HandFrame } from '@/vision/types';

type Props = {
  onFrame: (frame: HandFrame) => void;
  handVisible: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  showFps?: boolean;
};

/**
 * Live camera with hand tracking, plus the states around it (loading, error, "show your hand").
 * The camera only runs while its screen is focused, so switching tabs never leaves it on.
 */
export function CameraPanel({ onFrame, handVisible, children, style, showFps }: Props) {
  const [active, setActive] = useState(false);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [status, setStatus] = useState<EngineStatus>({ state: 'loading', message: 'Starting camera…' });
  const [fps, setFps] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setActive(true);
      return () => {
        setActive(false);
        setStatus({ state: 'loading', message: 'Starting camera…' });
      };
    }, []),
  );

  const flip = () => {
    setStatus({ state: 'loading', message: 'Switching camera…' });
    setFacing((f) => (f === 'user' ? 'environment' : 'user'));
  };

  return (
    <View style={[styles.wrap, style]}>
      {active && <VisionEngine key={facing} facing={facing} onFrame={onFrame} onStatus={setStatus} onFps={setFps} />}

      {status.state !== 'ready' && (
        <View style={styles.center} accessibilityLiveRegion="polite">
          {status.state === 'loading' ? (
            <>
              <ActivityIndicator color="#fff" />
              <Text style={styles.statusText}>{status.message}</Text>
            </>
          ) : (
            <>
              <SymbolView name="exclamationmark.triangle.fill" tintColor="#FFB224" size={28} />
              <Text style={styles.statusText}>Camera unavailable</Text>
              <Text style={styles.statusDetail}>{status.message}</Text>
            </>
          )}
        </View>
      )}

      {status.state === 'ready' && !handVisible && (
        <View style={styles.hintPill} pointerEvents="none">
          <SymbolView name="hand.raised" tintColor="#fff" size={15} />
          <Text style={styles.hintText}>Hold your hand up in view</Text>
        </View>
      )}

      {children}

      <View style={styles.topRight}>
        {showFps && status.state === 'ready' && <Text style={styles.fps}>{fps} fps</Text>}
        <Pressable
          onPress={flip}
          accessibilityRole="button"
          accessibilityLabel="Switch camera"
          style={styles.iconBtn}
          hitSlop={8}>
          <SymbolView name="arrow.triangle.2.circlepath.camera" tintColor="#fff" size={20} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#000', borderRadius: Radius.lg, overflow: 'hidden' },
  center: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  statusText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  statusDetail: { color: '#ffffffaa', fontSize: 13, textAlign: 'center' },
  hintPill: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: '#00000099',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  hintText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  topRight: {
    position: 'absolute',
    top: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  fps: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: '#00000080',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00000080',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
