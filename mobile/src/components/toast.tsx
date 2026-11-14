/** Short confirmations ("Saved", "IMP-0012 approved") at the top of the screen, with a haptic tick. */
import * as Haptics from 'expo-haptics';
import { Text, View } from 'react-native';
import Toast, { type ToastConfig } from 'react-native-toast-message';
import { cn, Icon, type IconName } from './ui';

type Kind = 'success' | 'error' | 'info';

const STYLE: Record<Kind, { box: string; text: string; accent: string; icon: IconName }> = {
  success: { box: 'bg-success-soft border-success', text: 'text-success', accent: 'accent-success', icon: 'check-circle' },
  error: { box: 'bg-destructive-soft border-destructive', text: 'text-destructive', accent: 'accent-destructive', icon: 'alert-circle' },
  info: { box: 'bg-card border-border', text: 'text-foreground', accent: 'accent-foreground', icon: 'info' },
};

function ToastView({ kind, text1, text2 }: { kind: Kind; text1?: string; text2?: string }) {
  const s = STYLE[kind];
  return (
    <View className={cn('mx-4 w-[92%] flex-row items-center gap-3 rounded-xl border px-4 py-3 shadow-md', s.box)} accessibilityRole="alert">
      <Icon name={s.icon} size={20} colorClassName={s.accent} />
      <View className="flex-1">
        <Text className={cn('text-[15px] font-semibold', s.text)}>{text1}</Text>
        {!!text2 && <Text className="text-[13px] text-muted-foreground">{text2}</Text>}
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
