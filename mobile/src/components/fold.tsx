/**
 * A section folded away until tapped ("More details", "More fields (optional)") — how the simple
 * view keeps the daily work up front without removing anything (web: Fold in components/page.tsx).
 * Drawn as one white card: the title row, and the fields inside it once open.
 *
 * Never hide a problem inside a closed section: pass `forceOpen` while something inside has an
 * error, and the section opens itself.
 */
import { type ReactNode, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './text';
import { cn, Icon } from './ui';

export function Fold({ title, children, defaultOpen = false, forceOpen = false, className }: { title: string; children: ReactNode; defaultOpen?: boolean; forceOpen?: boolean; className?: string }) {
  const [open, setOpen] = useState(defaultOpen || forceOpen);
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  return (
    <View className={cn('overflow-hidden rounded-3xl bg-card shadow-sm shadow-black/5', className)}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        className="min-h-14 flex-row items-center gap-2.5 px-4 py-3 active:bg-secondary"
      >
        <Icon name="plus" size={18} colorClassName="accent-saffron-strong" />
        <Text className="flex-1 text-[15px] font-semibold text-saffron-strong">{title}</Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} colorClassName="accent-muted-foreground" />
      </Pressable>
      {open && <View className="gap-3 border-t border-border px-4 pb-4 pt-3">{children}</View>}
    </View>
  );
}
