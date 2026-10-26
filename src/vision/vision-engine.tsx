import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { buildEngineHtml } from './engine-html';
import type { EngineStatus, HandFrame } from './types';

type Props = {
  facing?: 'user' | 'environment';
  maxFps?: number;
  showSkeleton?: boolean;
  onFrame: (frame: HandFrame) => void;
  onStatus?: (status: EngineStatus) => void;
  onFps?: (fps: number) => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Camera preview + on-device hand tracking. Emits raw landmarks only, so it can later be
 * swapped for a fully native engine (VisionCamera frame processor) without touching screens.
 */
export function VisionEngine({
  facing = 'user',
  maxFps = 24,
  showSkeleton = true,
  onFrame,
  onStatus,
  onFps,
  style,
}: Props) {
  const html = useMemo(() => buildEngineHtml({ facing, maxFps, showSkeleton }), [facing, maxFps, showSkeleton]);
  // Keep callbacks in a ref so a parent re-render never reloads the WebView.
  const handlers = useRef({ onFrame, onStatus, onFps });
  useEffect(() => {
    handlers.current = { onFrame, onStatus, onFps };
  });

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: any;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    const h = handlers.current;
    switch (msg.type) {
      case 'frame':
        h.onFrame({ t: msg.t, points: msg.points, aspect: msg.aspect, handedness: msg.handedness, hands: msg.hands });
        break;
      case 'status':
        h.onStatus?.({ state: 'loading', message: msg.message });
        break;
      case 'ready':
        h.onStatus?.({ state: 'ready', delegate: msg.delegate });
        break;
      case 'fps':
        h.onFps?.(msg.fps);
        break;
      case 'error':
        h.onStatus?.({ state: 'error', message: msg.message });
        break;
    }
  };

  return (
    <WebView
      style={[styles.web, style]}
      // An https base URL makes the page a secure context, which getUserMedia requires.
      source={{ html, baseUrl: 'https://localhost/' }}
      originWhitelist={['*']}
      javaScriptEnabled
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      mediaCapturePermissionGrantType="grant"
      scrollEnabled={false}
      bounces={false}
      onMessage={onMessage}
      onError={(e) => handlers.current.onStatus?.({ state: 'error', message: e.nativeEvent.description })}
    />
  );
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: '#000' },
});
