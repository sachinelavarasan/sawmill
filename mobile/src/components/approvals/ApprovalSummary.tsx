import { View } from 'react-native';
import { int } from '../../lib/format';
import { useT } from '../../lib/i18n';
import type { ApprovalQueue } from '../../lib/types';
import { Text } from '../text';
import { cn, Skeleton } from '../ui';

/** Compact approval queue breakdown using exact backend counts. */
export function ApprovalSummary({ counts, loading }: { counts?: ApprovalQueue['counts']; loading?: boolean }) {
  const t = useT();

  if (loading && !counts) {
    return (
      <View className="flex-row gap-2">
        {[0, 1, 2, 3].map((i) => (
          <View key={i} className="flex-1 gap-1.5 rounded-2xl bg-background p-3">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-6 w-8" />
          </View>
        ))}
      </View>
    );
  }

  if (!counts) return null;

  const cells: { label: string; count: number; highlight?: boolean }[] = [
    { label: t('pending'), count: counts.total, highlight: counts.total > 0 },
    { label: t('imports'), count: counts.IMPORT },
    { label: t('production'), count: counts.PRODUCTION },
    { label: t('exports'), count: counts.EXPORT },
  ];

  return (
    <View className="flex-row gap-2">
      {cells.map((c) => (
        <View
          key={c.label}
          className={cn(
            'flex-1 gap-0.5 rounded-2xl px-3 py-2.5',
            c.highlight ? 'border border-saffron/25 bg-saffron-soft' : 'bg-background',
          )}
          accessible
          accessibilityLabel={`${c.label}: ${int(c.count)}`}
        >
          <Text
            className={cn('text-[11px] font-medium', c.highlight ? 'text-saffron-strong' : 'text-muted-foreground')}
            numberOfLines={1}
          >
            {c.label}
          </Text>
          <Text
            className={cn(
              'text-xl font-bold tracking-tight tabular-nums font-display',
              c.highlight ? 'text-saffron-strong' : 'text-foreground',
            )}
          >
            {int(c.count)}
          </Text>
        </View>
      ))}
    </View>
  );
}
