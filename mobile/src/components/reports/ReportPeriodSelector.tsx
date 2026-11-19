import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { dateOnly, type Period, PERIOD_KEYS, presets } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { AppBottomSheet, DateField, SheetActions, useSheet } from '../sheet';
import { Text } from '../text';
import { Chip, Icon, Overline } from '../ui';

/** Compact reporting period bar with global bottom-sheet preset + custom calendar range picker. */
export function ReportPeriodSelector({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const t = useT();
  const sheet = useSheet();
  const p = presets();
  const matchedKey = PERIOD_KEYS.find((k) => p[k].from === value.from && p[k].to === value.to);
  const [draft, setDraft] = useState<Period>(value);
  const [showCustom, setShowCustom] = useState(!matchedKey);

  const label = matchedKey ? t(matchedKey) : t('customRange');
  const rangeText = `${dateOnly(value.from)} – ${dateOnly(value.to)}`;

  return (
    <>
      <Pressable
        onPress={() => {
          setDraft(value);
          setShowCustom(!matchedKey);
          sheet.open();
        }}
        accessibilityRole="button"
        accessibilityLabel={`${t('selectedPeriod')}: ${label}, ${rangeText}`}
        className="flex-row items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 active:bg-secondary"
      >
        <View className="h-9 w-9 items-center justify-center rounded-xl bg-saffron-soft">
          <Icon name="calendar" size={17} colorClassName="accent-saffron-strong" />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-[11px] font-semibold uppercase tracking-[0.8px] text-muted-foreground" numberOfLines={1}>
            {t('selectedPeriod')}
          </Text>
          <Text className="text-[14px] font-semibold text-foreground" numberOfLines={1}>
            {label} · <Text className="font-medium tabular-nums text-muted-foreground">{rangeText}</Text>
          </Text>
        </View>
        <Icon name="chevron-down" size={18} colorClassName="accent-muted-foreground" />
      </Pressable>

      <AppBottomSheet
        ref={sheet.ref}
        variant="medium"
        title={t('period')}
        footer={
          showCustom ? (
            <SheetActions
              primary={{
                title: t('apply'),
                disabled: draft.from > draft.to,
                onPress: () => {
                  onChange(draft);
                  sheet.close();
                },
              }}
            />
          ) : undefined
        }
      >
        <View className="gap-4">
          <View className="gap-2">
            <Overline>{t('selectedPeriod')}</Overline>
            <View className="flex-row flex-wrap gap-2">
              {PERIOD_KEYS.map((k) => {
                const active = p[k].from === value.from && p[k].to === value.to;
                return (
                  <Chip
                    key={k}
                    text={t(k)}
                    on={active && !showCustom}
                    onPress={() => {
                      setShowCustom(false);
                      onChange(p[k]);
                      sheet.close();
                    }}
                  />
                );
              })}
              <Chip
                text={t('customRange')}
                on={showCustom || !matchedKey}
                onPress={() => setShowCustom(true)}
              />
            </View>
          </View>

          {showCustom && (
            <View className="gap-3">
              <DateField label={t('from')} value={draft.from} max={draft.to} onChange={(from) => setDraft((d) => ({ ...d, from }))} />
              <DateField label={t('to')} value={draft.to} min={draft.from} onChange={(to) => setDraft((d) => ({ ...d, to }))} />
            </View>
          )}
        </View>
      </AppBottomSheet>
    </>
  );
}
