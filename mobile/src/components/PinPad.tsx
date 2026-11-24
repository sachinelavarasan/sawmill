/**
 * PIN entry for the app lock: four dots and a big keypad (no phone keyboard). Calls `onComplete`
 * as soon as the fourth digit is pressed. The bottom-left key is optional (fingerprint).
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { PIN_LENGTH } from '../lib/app-lock';
import { useT } from '../lib/i18n';
import { Tap } from './motion';
import { Text } from './text';
import { cn, Icon, type IconName } from './ui';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export function PinPad({
  title,
  error,
  onComplete,
  extraKey,
  onDark,
  resetKey,
}: {
  title: string;
  error?: string | null;
  /** may be async; the dots clear when it settles */
  onComplete: (pin: string) => unknown;
  extraKey?: { icon: IconName; label: string; onPress: () => void };
  /** on the navy lock screen */
  onDark?: boolean;
  /** change it to clear the dots (e.g. moving from "choose" to "confirm") */
  resetKey?: unknown;
}) {
  const t = useT();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => setPin(''), [resetKey]);

  async function press(d: string) {
    if (busy || pin.length >= PIN_LENGTH) return;
    const next = pin + d;
    setPin(next);
    if (next.length < PIN_LENGTH) return;
    setBusy(true);
    try {
      await onComplete(next);
    } finally {
      setPin('');
      setBusy(false);
    }
  }

  const fg = onDark ? 'text-hero-foreground' : 'text-foreground';
  const key = cn('h-[68px] w-[30%] items-center justify-center rounded-full', onDark ? 'bg-hero-chip active:bg-hero-border' : 'bg-card shadow-sm shadow-black/5 active:bg-secondary');

  return (
    <View className="w-full max-w-[340px] items-center gap-6 self-center">
      <Text className={cn('text-center text-lg font-semibold', fg)}>{title}</Text>
      <View className="flex-row gap-4" accessibilityLabel={`${pin.length} / ${PIN_LENGTH}`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <View key={i} className={cn('h-4 w-4 rounded-full border-2', onDark ? 'border-hero-foreground' : 'border-foreground', i < pin.length && (onDark ? 'bg-hero-foreground' : 'bg-foreground'))} />
        ))}
      </View>
      <Text className={cn('min-h-5 text-center text-sm font-medium', error ? 'text-destructive' : 'text-transparent')} accessibilityLiveRegion="polite">
        {error ?? ' '}
      </Text>
      <View className="w-full flex-row flex-wrap justify-between gap-y-3">
        {DIGITS.map((d) => (
          <Tap key={d} scale={0.92} haptic onPress={() => void press(d)} accessibilityRole="button" accessibilityLabel={d} className={key}>
            <Text className={cn('text-[28px] font-semibold', fg)}>{d}</Text>
          </Tap>
        ))}
        {extraKey ? (
          <Tap scale={0.92} onPress={extraKey.onPress} accessibilityRole="button" accessibilityLabel={extraKey.label} className={key}>
            <Icon name={extraKey.icon} size={28} colorClassName={onDark ? 'accent-saffron' : 'accent-foreground'} />
          </Tap>
        ) : (
          <View className="w-[30%]" />
        )}
        <Tap scale={0.92} haptic onPress={() => void press('0')} accessibilityRole="button" accessibilityLabel="0" className={key}>
          <Text className={cn('text-[28px] font-semibold', fg)}>0</Text>
        </Tap>
        <Tap scale={0.92} onPress={() => setPin((p) => p.slice(0, -1))} accessibilityRole="button" accessibilityLabel={t('delete')} className={key}>
          <Icon name="delete" size={26} colorClassName={onDark ? 'accent-hero-foreground' : 'accent-foreground'} />
        </Tap>
      </View>
    </View>
  );
}
