/**
 * Home in lorry-only mode (lib/lorry-mode.ts): a greeting, and the three jobs at the gate as big
 * cards — nothing else to choose from.
 *
 *   Lorry In      a lorry brought logs           → app/(app)/lorry-in.tsx   (lorry icon)
 *   Measure Logs  time the unloading, measure     → app/(app)/measure-logs.tsx (with how many lorries wait)
 *   Lorry Out     load sawn pieces on a lorry    → app/(app)/lorry-out.tsx  (the same lorry, facing out)
 *   Loads out     (a plain row) the lorries already loaded → app/(app)/load-outs.tsx
 *
 * The avatar opens the profile sheet: language, light / dark, sign out.
 */
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';
import { useStatusBar } from '../header';
import { Appear, Tap } from '../motion';
import { ProfileSheet } from '../ProfileSheet';
import { useSheet } from '../sheet';
import { TreeRings } from '../glow';
import { Text } from '../text';
import { Avatar, Icon, type IconName, MOD, type Mod, ModTile, refresher } from '../ui';
import { dateOnly, todayIso } from '../../lib/format';
import { useT } from '../../lib/i18n';
import type { ImportSummary } from '../../lib/imports-api';
import { useApi } from '../../lib/query';
import { useUser } from '../../lib/session';
import type { Paged } from '../../lib/types';

function greetingKey() {
  const h = new Date().getHours();
  return h < 12 ? 'goodMorning' : h < 17 ? 'goodAfternoon' : 'goodEvening';
}

export function LorryHome() {
  const t = useT();
  const router = useRouter();
  const user = useUser();
  const insets = useSafeAreaInsets();
  const profile = useSheet();
  useStatusBar(false);
  // lorries still being unloaded or measured
  const open = useApi<Paged<ImportSummary>>('/imports?take=1&skip=0&open=1');
  const waiting = open.data?.total ?? 0;

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-3 px-4"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }}
      refreshControl={refresher(open.isRefetching, () => void open.refetch())}
    >
      <View className="flex-row items-center gap-3 pb-1">
        <View className="flex-1 gap-0.5">
          <Text className="text-[14px] text-muted-foreground">{t(greetingKey())},</Text>
          <Text className="text-[22px] font-bold leading-7 tracking-tight text-foreground font-display" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} accessibilityRole="header">
            {user.name}
          </Text>
          <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
            {user.mill.name} · {dateOnly(todayIso())}
          </Text>
        </View>
        <Pressable onPress={profile.open} accessibilityRole="button" accessibilityLabel={t('profile')} className="h-12 w-12 items-center justify-center rounded-full active:opacity-80">
          <Avatar name={user.name} size="md" tone="saffron" />
        </Pressable>
      </View>

      <Appear index={0}>
        <JobCard mod="in" icon="truck" title={t('lorryIn')} sub={t('lorryInSub')} onPress={() => router.push('/lorry-in')} />
      </Appear>
      <Appear index={1}>
        <JobCard mod="logs" icon="ruler" title={t('simpleMeasure')} sub={t('measureLogsSub')} badge={waiting} onPress={() => router.push('/measure-logs')} />
      </Appear>
      <Appear index={2}>
        <JobCard mod="out" icon="truck-out" title={t('lorryOut')} sub={t('lorryOutSub')} onPress={() => router.push('/lorry-out')} />
      </Appear>
      {/* the lorries already loaded: where each one stands with the owner */}
      <Appear index={3}>
        <ListLink mod="out" icon="list" title={t('exports')} onPress={() => router.push('/load-outs')} />
      </Appear>

      <ProfileSheet ref={profile.ref} />
    </ScrollView>
  );
}

/** A plain row under the jobs: a list to look back at (the load outs). */
function ListLink({ mod, icon, title, onPress }: { mod: Mod; icon: IconName; title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="min-h-[60px] flex-row items-center gap-3 rounded-2xl border border-control-border bg-card px-4 py-2.5 active:bg-secondary">
      <ModTile mod={mod} icon={icon} size="sm" />
      <Text className="flex-1 text-[16px] font-semibold text-foreground">{title}</Text>
      <Icon name="chevron-right" size={20} colorClassName="accent-muted-foreground" />
    </Pressable>
  );
}

/** One job: its coloured tile, a big name, one line of what it is, faint tree rings, and an arrow. */
function JobCard({ mod, icon, title, sub, badge, onPress }: { mod: Mod; icon: IconName; title: string; sub: string; badge?: number; onPress: () => void }) {
  const [ring] = useCSSVariable([MOD[mod].ring]).map(String);
  return (
    <Tap
      scale={0.98}
      haptic
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${title}, ${badge}. ${sub}` : `${title}. ${sub}`}
      className="min-h-[96px] flex-row items-center gap-3.5 overflow-hidden rounded-3xl bg-card px-4 py-4 shadow-sm shadow-black/5"
    >
      <TreeRings color={ring} placement="right" size={220} opacity={0.12} />
      <ModTile mod={mod} icon={icon} size="md" />
      <View className="min-w-0 flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text className="shrink text-[19px] font-bold tracking-tight text-foreground font-display" numberOfLines={1}>
            {title}
          </Text>
          {!!badge && (
            <View className="h-6 min-w-6 items-center justify-center rounded-full bg-saffron px-1.5">
              <Text className="text-[12px] font-bold tabular-nums text-saffron-foreground">{badge}</Text>
            </View>
          )}
        </View>
        <Text className="text-[14px] leading-5 text-muted-foreground" numberOfLines={2}>{sub}</Text>
      </View>
      <Icon name="chevron-right" size={20} colorClassName="accent-muted-foreground" />
    </Tap>
  );
}
