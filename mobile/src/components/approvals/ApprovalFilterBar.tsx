import { Pressable, ScrollView, View } from 'react-native';
import type { Period } from '../../lib/format';
import { useT } from '../../lib/i18n';
import type { ApprovalKind, ApprovalQueue } from '../../lib/types';
import { APPROVAL_KIND } from '../cards';
import { AppBottomSheet, PeriodPicker, SheetActions, useSheet } from '../sheet';
import { Text } from '../text';
import { Chip, cn, Icon, Overline, Segmented } from '../ui';

export type ApprovalSort = 'oldest' | 'newest';

/** Horizontal operation filter chips + global bottom sheet for sort and date filters. */
export function ApprovalFilterBar({
  kind,
  onKind,
  counts,
  sort,
  onSort,
  period,
  onPeriod,
}: {
  kind: ApprovalKind | '';
  onKind: (k: ApprovalKind | '') => void;
  counts?: ApprovalQueue['counts'];
  sort: ApprovalSort;
  onSort: (s: ApprovalSort) => void;
  period: Period | null;
  onPeriod: (p: Period | null) => void;
}) {
  const t = useT();
  const sheet = useSheet();
  const hasAdvanced = sort !== 'oldest' || period !== null;

  const kinds: ApprovalKind[] = ['IMPORT', 'PRODUCTION', 'EXPORT'];
  if ((counts?.ADJUSTMENT ?? 0) > 0 || kind === 'ADJUSTMENT') {
    kinds.push('ADJUSTMENT');
  }

  return (
    <>
      <View className="flex-row items-center gap-2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1" contentContainerClassName="gap-1.5 pr-1">
          <Chip alert text={t('allPending')} on={!kind} count={counts?.total} onPress={() => onKind('')} />
          {kinds.map((k) => (
            <Chip alert key={k} text={t(APPROVAL_KIND[k].labelKey)} on={kind === k} count={counts?.[k]} onPress={() => onKind(k)} />
          ))}
        </ScrollView>
        <Pressable
          onPress={sheet.open}
          accessibilityRole="button"
          accessibilityLabel={t('sortAndDates')}
          className={cn(
            'min-h-9 flex-row items-center gap-1.5 rounded-full border px-3',
            hasAdvanced ? 'border-saffron/35 bg-saffron-soft' : 'border-border bg-card active:bg-secondary',
          )}
        >
          <Icon name="sliders" size={14} colorClassName={hasAdvanced ? 'accent-saffron-strong' : 'accent-muted-foreground'} />
          <Text className={cn('text-[12px] font-semibold', hasAdvanced ? 'text-saffron-strong' : 'text-muted-foreground')}>
            {t('filters')}
          </Text>
        </Pressable>
      </View>

      <AppBottomSheet
        ref={sheet.ref}
        variant="medium"
        title={t('sortAndDates')}
        footer={
          <SheetActions
            primary={{ title: t('close'), onPress: sheet.close }}
            secondary={
              hasAdvanced
                ? [
                    {
                      title: t('reset'),
                      onPress: () => {
                        onSort('oldest');
                        onPeriod(null);
                        sheet.close();
                      },
                    },
                  ]
                : undefined
            }
          />
        }
      >
        <View className="gap-4">
          <View className="gap-2">
            <Overline>{t('sortBy')}</Overline>
            <Segmented
              value={sort}
              onChange={onSort}
              options={[
                { value: 'oldest', label: t('oldestFirst') },
                { value: 'newest', label: t('newestFirst') },
              ]}
            />
          </View>
          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Overline>{t('submittedOn')}</Overline>
              {period && (
                <Pressable onPress={() => onPeriod(null)} hitSlop={8}>
                  <Text className="text-xs font-semibold text-saffron-strong">{t('anyDate')}</Text>
                </Pressable>
              )}
            </View>
            <PeriodPicker value={period} onChange={onPeriod} />
          </View>
        </View>
      </AppBottomSheet>
    </>
  );
}
