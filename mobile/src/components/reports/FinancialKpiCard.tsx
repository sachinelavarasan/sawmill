import { View } from 'react-native';
import { Text } from '../text';
import { Tap } from '../motion';
import { cn, Icon, type IconName, TONE_ACCENT, TONE_BG, TONE_TEXT, type Tone } from '../ui';

/** Compact secondary financial KPI card (Sales, Purchases, Total Expenses). */
export function FinancialKpiCard({
  label,
  value,
  icon,
  tone,
  onPress,
}: {
  label: string;
  value: string;
  icon: IconName;
  tone?: Tone;
  onPress?: () => void;
}) {
  const body = (
    <>
      <View className="flex-row items-center gap-1.5">
        <View className={cn('h-6 w-6 items-center justify-center rounded-lg', tone ? TONE_BG[tone] : 'bg-background')}>
          <Icon name={icon} size={13} colorClassName={tone ? TONE_ACCENT[tone] : 'accent-muted-foreground'} />
        </View>
        <Text className="flex-1 text-[11px] font-medium text-muted-foreground" numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text
        className={cn('text-[17px] font-bold tracking-tight tabular-nums font-display', tone ? TONE_TEXT[tone] : 'text-foreground')}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </>
  );

  const box = 'flex-1 gap-1.5 rounded-2xl bg-card p-3 shadow-sm shadow-black/5';
  if (!onPress) {
    return (
      <View className={box} accessible accessibilityLabel={`${label}: ${value}`}>
        {body}
      </View>
    );
  }
  return (
    <Tap scale={0.97} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} className={cn(box, 'active:bg-secondary')}>
      {body}
    </Tap>
  );
}
