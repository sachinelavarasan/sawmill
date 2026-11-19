import { useRouter } from 'expo-router';
import { forwardRef } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './text';
import { useT } from '../lib/i18n';
import { QUICK_ADD, visible } from '../lib/nav';
import { useSession } from '../lib/session';
import { AppBottomSheet, type SheetHandle } from './bottom-sheet';
import { IconTile } from './ui';

/** "What do you want to add?" — only the actions this person is allowed to take. */
export const QuickAddSheet = forwardRef<SheetHandle>(function QuickAddSheet(_, ref) {
  const t = useT();
  const router = useRouter();
  const { can } = useSession();
  const items = QUICK_ADD.filter((i) => visible(i, can));
  return (
    <AppBottomSheet ref={ref} variant="medium" title={t('quickAddTitle')}>
      <View className="flex-row flex-wrap gap-3">
        {items.map((i) => (
          <Pressable
            key={i.key}
            onPress={() => {
              (ref as React.RefObject<SheetHandle | null>).current?.close();
              router.push(i.href as never);
            }}
            accessibilityRole="button"
            accessibilityLabel={t(i.labelKey)}
            className="min-h-[96px] grow basis-[46%] justify-between gap-3 rounded-2xl border border-border bg-background p-4 active:bg-secondary"
          >
            <IconTile icon={i.icon} />
            <Text className="text-[15px] font-semibold text-foreground" numberOfLines={2}>
              {t(i.labelKey)}
            </Text>
          </Pressable>
        ))}
      </View>
    </AppBottomSheet>
  );
});
