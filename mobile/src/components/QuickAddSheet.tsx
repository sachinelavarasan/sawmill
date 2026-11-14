import { useRouter } from 'expo-router';
import { forwardRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useT } from '../lib/i18n';
import { QUICK_ADD, visible } from '../lib/nav';
import { useSession } from '../lib/session';
import { Sheet, type SheetHandle } from './sheet';
import { Icon } from './ui';

/** "What do you want to add?" — only the actions this person is allowed to take. */
export const QuickAddSheet = forwardRef<SheetHandle>(function QuickAddSheet(_, ref) {
  const t = useT();
  const router = useRouter();
  const { can } = useSession();
  const items = QUICK_ADD.filter((i) => visible(i, can));
  return (
    <Sheet ref={ref} title={t('quickAddTitle')}>
      <View className="flex-row flex-wrap gap-2.5 px-5">
        {items.map((i) => (
          <Pressable
            key={i.key}
            onPress={() => {
              (ref as React.RefObject<SheetHandle | null>).current?.close();
              router.push(i.href as never);
            }}
            accessibilityRole="button"
            className="min-h-24 grow basis-[46%] justify-between gap-3 rounded-xl border border-border bg-background p-3.5 active:bg-secondary"
          >
            <View className="h-10 w-10 items-center justify-center rounded-lg bg-saffron-soft">
              <Icon name={i.icon} size={20} colorClassName="accent-warning" />
            </View>
            <Text className="text-[15px] font-semibold text-foreground" numberOfLines={2}>
              {t(i.labelKey)}
            </Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
});
