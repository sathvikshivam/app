import AsyncStorage from '@react-native-async-storage/async-storage';

/** Small JSON wrapper around AsyncStorage. Everything stays on the device. */
export async function load<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function save<T>(key: string, value: T) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Progress is a nice-to-have; never crash the app over it.
  }
}

export const KEYS = {
  progress: 'signbridge.progress.v1',
  samples: 'signbridge.samples.v1',
  onboarded: 'signbridge.onboarded.v1',
} as const;
