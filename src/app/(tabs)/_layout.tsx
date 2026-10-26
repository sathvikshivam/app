import { NativeTabs } from 'expo-router/native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function TabsLayout() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.primarySoft}
      tintColor={colors.primary}
      labelStyle={{ selected: { color: colors.primary } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Translate</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="hand.raised.fill" md="back_hand" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="learn">
        <NativeTabs.Trigger.Label>Learn</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="graduationcap.fill" md="school" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="spell">
        <NativeTabs.Trigger.Label>Text → Sign</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="character.bubble.fill" md="translate" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="alphabet">
        <NativeTabs.Trigger.Label>Dictionary</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="book.fill" md="menu_book" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
