/**
 * A section folded away until tapped ("More details", "More fields (optional)") — how the simple
 * view keeps the daily work up front without removing anything (web: Fold in components/page.tsx).
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
    <View className={cn('gap-3', className)}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        className="min-h-12 flex-row items-center gap-2.5 rounded-2xl border border-input bg-card px-4 py-3 active:opacity-80"
      >
        <Text className="flex-1 text-[15px] font-semibold text-foreground">{title}</Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} colorClassName="accent-muted-foreground" />
      </Pressable>
      {open && <View className="gap-3">{children}</View>}
    </View>
  );
}
