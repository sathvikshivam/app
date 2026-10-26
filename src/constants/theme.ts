/**
 * SignBridge design tokens. Every screen pulls colors from here so light and dark mode stay in sync.
 */

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0E0F1A',
    textSecondary: '#5C6070',
    background: '#F6F6FA',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#ECEDF5',
    border: '#E2E3EC',
    primary: '#5B5FEF',
    primarySoft: '#E7E8FF',
    onPrimary: '#FFFFFF',
    success: '#15A05A',
    successSoft: '#DDF6E8',
    danger: '#E5484D',
  },
  dark: {
    text: '#F4F5FA',
    textSecondary: '#A3A7B7',
    background: '#0B0C12',
    backgroundElement: '#171922',
    backgroundSelected: '#222533',
    border: '#2A2D3B',
    primary: '#7C83FF',
    primarySoft: '#262A52',
    onPrimary: '#FFFFFF',
    success: '#3DD68C',
    successSoft: '#123524',
    danger: '#FF6369',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
