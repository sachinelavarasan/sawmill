/** Short confirmations ("Saved", "IMP-0012 approved") at the top of the screen, with a haptic tick. */
import * as Haptics from 'expo-haptics';
import { View } from 'react-native';
import { Text } from './text';
import Toast, { type ToastConfig } from 'react-native-toast-message';
import { cn, Icon, type IconName } from './ui';

type Kind = 'success' | 'error' | 'info';

/** The kind shows only in the small round chip; the card itself is the app's plain card. */
const STYLE: Record<Kind, { chip: string; accent: string; icon: IconName }> = {
  success: { chip: 'bg-success-soft', accent: 'accent-success', icon: 'check' },
  error: { chip: 'bg-destructive-soft', accent: 'accent-destructive', icon: 'x' },
  info: { chip: 'bg-saffron-soft', accent: 'accent-saffron', icon: 'info' },
};

/** A compact card that sizes to its text: round icon chip, one bold line, an optional muted second line. */
function ToastView({ kind, text1, text2 }: { kind: Kind; text1?: string; text2?: string }) {
  const s = STYLE[kind];
  return (
    <View className="max-w-[88%] flex-row items-center gap-2.5 self-center rounded-2xl border border-border bg-card py-2 pr-4 pl-2 shadow-lg" accessibilityRole="alert">
      <View className={cn('h-7 w-7 items-center justify-center rounded-full', s.chip)}>
        <Icon name={s.icon} size={15} colorClassName={s.accent} />
      </View>
      <View className="shrink">
        <Text className="text-[14px] font-semibold text-foreground" numberOfLines={2}>
          {text1}
        </Text>
        {!!text2 && (
          <Text className="text-[12px] text-muted-foreground" numberOfLines={2}>
            {text2}
          </Text>
        )}
      </View>
    </View>
  );
}

const config: ToastConfig = {
  success: (p) => <ToastView kind="success" text1={p.text1} text2={p.text2} />,
  error: (p) => <ToastView kind="error" text1={p.text1} text2={p.text2} />,
  info: (p) => <ToastView kind="info" text1={p.text1} text2={p.text2} />,
};

export function ToastHost() {
  return <Toast config={config} topOffset={56} />;
}

export function toast(text1: string, kind: Kind = 'success', text2?: string) {
  void Haptics.notificationAsync(
    kind === 'success' ? Haptics.NotificationFeedbackType.Success : kind === 'error' ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Warning,
  ).catch(() => undefined);
  Toast.show({ type: kind, text1, text2, visibilityTime: 2200 });
}
