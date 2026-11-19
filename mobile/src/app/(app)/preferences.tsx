/**
 * Preferences: how this person likes to use the app, on this phone — language, appearance, the
 * Home dashboard (which sections, in what order), the screen the app opens on, list density and
 * date format, and how notifications look while the app is open.
 *
 * Every change applies at once and is saved by itself (services/preferences). Only what this
 * person may open is offered: dashboard sections and landing screens are filtered by permission.
 *
 * `?section=notifications|appearance|…` scrolls straight to that section (from the More screen).
 */
import { Permission } from '@timbertrail/shared';
import { useLocalSearchParams } from 'expo-router';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Linking, type LayoutChangeEvent, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConfirm } from '../../components/confirm';
import { ScreenHeader } from '../../components/header';
import { Text } from '../../components/text';
import { toast } from '../../components/toast';
import { Button, Chip, cn, Icon, IconTile, MenuGroup, MenuRow, Muted, Overline, Pill, Segmented, Toggle } from '../../components/ui';
import { isoDay } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { applyReminder, DEFAULT_REMINDER, loadReminder, type ReminderSetting, useNotifications } from '../../lib/notifications';
import { useSession } from '../../lib/session';
import {
  availableLandingScreens,
  availableWidgets,
  type DashboardWidget,
  type DateFormat,
  defaultPreferences,
  type Language,
  type ListDensity,
  type ThemePreference,
  usePreferences,
  type WidgetInfo,
} from '../../services/preferences';

type SectionId = 'language' | 'appearance' | 'dashboard' | 'navigation' | 'display' | 'notifications';

function Section({ title, sub, onLayout, children }: { title: string; sub?: string; onLayout: (e: LayoutChangeEvent) => void; children: ReactNode }) {
  return (
    <View className="gap-2.5 pt-3" onLayout={onLayout}>
      <Overline className="px-1">{title}</Overline>
      {!!sub && <Muted className="px-1">{sub}</Muted>}
      {children}
    </View>
  );
}

/** "Selected" mark for a choice row (keeps the row free of the chevron). */
const Check = ({ on }: { on: boolean }) => (on ? <Icon name="check" size={18} colorClassName="accent-saffron-strong" /> : <View className="w-[18px]" />);

/** Today's date written each way, so the choice shows what it does. */
function dateExamples(): Record<DateFormat, string> {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    medium: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    numeric: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
    iso: isoDay(d),
  };
}

export default function PreferencesScreen() {
  const t = useT();
  const { section } = useLocalSearchParams<{ section?: SectionId }>();
  const { prefs, language, theme, update, setLanguage, setTheme, reset } = usePreferences();
  const { can } = useSession();
  const confirm = useConfirm();
  const insets = useSafeAreaInsets();

  // ── jump to ?section= once its place is known ──
  const scroll = useRef<ScrollView>(null);
  const jumped = useRef(false);
  const at = (id: SectionId) => (e: LayoutChangeEvent) => {
    if (jumped.current || section !== id) return;
    jumped.current = true;
    const y = e.nativeEvent.layout.y;
    requestAnimationFrame(() => scroll.current?.scrollTo({ y: Math.max(0, y - 8), animated: true }));
  };

  // ── dashboard ──
  const role = can(Permission.DASHBOARD_OWNER) ? 'owner' : 'accountant';
  const offered = availableWidgets(role, can);
  const offeredIds = new Set(offered.map((w) => w.id));
  const ordered = prefs.dashboard.widgetOrder.filter((id) => offeredIds.has(id)).map((id) => offered.find((w) => w.id === id) as WidgetInfo);
  const shown = new Set(prefs.dashboard.visibleWidgets);

  /** swap with the neighbour this person can see (other roles' sections keep their places) */
  const move = (id: DashboardWidget, dir: -1 | 1) =>
    update((p) => {
      const order = [...p.dashboard.widgetOrder];
      const mine = order.filter((x) => offeredIds.has(x));
      const i = mine.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= mine.length) return p;
      const a = order.indexOf(mine[i]);
      const b = order.indexOf(mine[j]);
      [order[a], order[b]] = [order[b], order[a]];
      return { ...p, dashboard: { ...p.dashboard, widgetOrder: order } };
    });
  const showWidget = (id: DashboardWidget, on: boolean) =>
    update((p) => ({
      ...p,
      dashboard: { ...p.dashboard, visibleWidgets: on ? [...new Set([...p.dashboard.visibleWidgets, id])] : p.dashboard.visibleWidgets.filter((x) => x !== id) },
    }));
  const restoreLayout = () => update((p) => ({ ...p, dashboard: defaultPreferences().dashboard }));

  const setDisplay = <K extends keyof typeof prefs.display>(k: K, v: (typeof prefs.display)[K]) =>
    update((p) => (p.display[k] === v ? p : { ...p, display: { ...p.display, [k]: v } }));
  const setNote = (k: keyof typeof prefs.notifications, v: boolean) => update((p) => ({ ...p, notifications: { ...p.notifications, [k]: v } }));

  const examples = dateExamples();
  const landings = availableLandingScreens(can);

  return (
    <View className="flex-1 bg-card">
      <ScreenHeader compact back title={t('preferences')} subtitle={t('preferencesNote')} />
      <ScrollView ref={scroll} className="flex-1 bg-card" contentContainerClassName="gap-3 px-4 pt-2" contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <Section title={t('language')} onLayout={at('language')}>
          <Segmented<Language>
            value={language}
            onChange={setLanguage}
            options={[
              { value: 'en', label: 'English' },
              { value: 'ta', label: 'தமிழ்' },
            ]}
          />
        </Section>

        <Section title={t('appearance')} onLayout={at('appearance')}>
          <Segmented<ThemePreference>
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'light', label: t('themeLight') },
              { value: 'dark', label: t('themeDark') },
              { value: 'system', label: t('themeSystem') },
            ]}
          />
        </Section>

        <Section title={t('dashboardLayout')} sub={t('dashboardLayoutSub')} onLayout={at('dashboard')}>
          <MenuGroup inset>
            {ordered.map((w, i) => {
              const on = shown.has(w.id);
              return (
                <View key={w.id} className={cn('min-h-[60px] flex-row items-center gap-2 py-2 pl-4 pr-3', i < ordered.length - 1 && 'border-b border-card')}>
                  <View className={on ? undefined : 'opacity-40'}>
                    <IconTile icon={w.icon} tone="navy" size="sm" raised />
                  </View>
                  <Text className={cn('flex-1 pl-1.5 text-[15px] font-semibold leading-5', on ? 'text-foreground' : 'text-muted-foreground')} numberOfLines={2}>
                    {t(w.labelKey)}
                  </Text>
                  <Mover icon="chevron-up" label={`${t('moveUp')}: ${t(w.labelKey)}`} disabled={i === 0} onPress={() => move(w.id, -1)} />
                  <Mover icon="chevron-down" label={`${t('moveDown')}: ${t(w.labelKey)}`} disabled={i === ordered.length - 1} onPress={() => move(w.id, 1)} />
                  <Toggle value={on} onChange={(v) => showWidget(w.id, v)} label={t(w.labelKey)} />
                </View>
              );
            })}
          </MenuGroup>
          <Button kind="ghost" size="md" icon="refresh-cw" title={t('restoreDefaultLayout')} onPress={restoreLayout} className="self-start" />
        </Section>

        <Section title={t('navigationPref')} sub={`${t('landingScreen')} · ${t('landingScreenSub')}`} onLayout={at('navigation')}>
          <MenuGroup inset>
            {landings.map((l, i) => (
              <MenuRow
                key={l.id}
                icon={l.icon}
                title={t(l.labelKey)}
                last={i === landings.length - 1}
                right={<Check on={prefs.defaultLandingScreen === l.id} />}
                onPress={() => update((p) => (p.defaultLandingScreen === l.id ? p : { ...p, defaultLandingScreen: l.id }))}
              />
            ))}
          </MenuGroup>
        </Section>

        <Section title={t('display')} onLayout={at('display')}>
          <Text className="px-1 text-[13px] font-semibold text-foreground">{t('listDensity')}</Text>
          <Segmented<ListDensity>
            value={prefs.display.listDensity}
            onChange={(v) => setDisplay('listDensity', v)}
            options={[
              { value: 'comfortable', label: t('densityComfortable') },
              { value: 'compact', label: t('densityCompact') },
            ]}
          />
          <Text className="px-1 pt-2 text-[13px] font-semibold text-foreground">{t('dateFormat')}</Text>
          <MenuGroup inset>
            {(['medium', 'numeric', 'iso'] as const).map((f, i, all) => (
              <MenuRow key={f} icon="calendar" title={examples[f]} last={i === all.length - 1} right={<Check on={prefs.display.dateFormat === f} />} onPress={() => setDisplay('dateFormat', f)} />
            ))}
          </MenuGroup>
        </Section>

        <NotificationsSection onLayout={at('notifications')} banner={prefs.notifications.inAppBanner} sound={prefs.notifications.inAppSound} onChange={setNote} />

        <View className="gap-2 pt-6">
          <Button
            kind="danger"
            icon="refresh-cw"
            title={t('resetPreferences')}
            onPress={async () => {
              const ok = await confirm({ title: t('resetPreferences'), message: t('resetPreferencesConfirm'), confirmText: t('reset'), cancelText: t('cancel'), destructive: true });
              if (!ok) return;
              reset();
              toast(t('saved'));
            }}
          />
          <Muted className="text-center">{t('preferencesNote')}</Muted>
        </View>
      </ScrollView>
    </View>
  );
}

/** Small up / down button in a dashboard row (44px touch area). */
function Mover({ icon, label, disabled, onPress }: { icon: 'chevron-up' | 'chevron-down'; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      className={cn('h-10 w-9 items-center justify-center rounded-full active:bg-card', disabled && 'opacity-30')}
    >
      <Icon name={icon} size={18} colorClassName="accent-foreground" />
    </Pressable>
  );
}

const REMINDER_HOURS = [16, 17, 18, 19, 20, 21];
const hourLabel = (h: number) => `${((h + 11) % 12) + 1} ${h < 12 ? 'AM' : 'PM'}`;

/**
 * Two clearly separate halves:
 *  - On this phone: how notifications look while the app is open, and the daily reminder (a
 *    notification the phone schedules itself). Nothing here reaches the server.
 *  - From TimberTrail: the push notifications the server sends this phone while signed in
 *    (approvals, record updates) — needs the phone's permission.
 */
function NotificationsSection({
  onLayout,
  banner,
  sound,
  onChange,
}: {
  onLayout: (e: LayoutChangeEvent) => void;
  banner: boolean;
  sound: boolean;
  onChange: (k: 'inAppBanner' | 'inAppSound', v: boolean) => void;
}) {
  const t = useT();
  const { status, refresh } = useNotifications();
  const [reminder, setReminder] = useState<ReminderSetting>(DEFAULT_REMINDER);
  useEffect(() => {
    void loadReminder().then(setReminder);
  }, []);
  const saveReminder = async (r: ReminderSetting) => {
    setReminder(r); // feels instant; corrected below if permission is refused
    setReminder(await applyReminder(r, { title: t('reminderTitle'), body: t('reminderBody') }));
  };
  const on = status === 'granted';

  return (
    <View onLayout={onLayout} className="gap-3 pt-3">
      <Overline className="px-1">{t('notifications')}</Overline>

      <View className="gap-2.5">
        <View className="flex-row items-center gap-2 px-1">
          <Icon name="smartphone" size={14} colorClassName="accent-muted-foreground" />
          <Text className="text-[13px] font-semibold text-foreground">{t('onThisPhone')}</Text>
        </View>
        <Muted className="px-1">{t('onThisPhoneSub')}</Muted>
        <MenuGroup inset>
          <MenuRow icon="bell" title={t('inAppBanner')} subtitle={t('inAppBannerSub')} right={<Toggle value={banner} onChange={(v) => onChange('inAppBanner', v)} label={t('inAppBanner')} />} />
          <MenuRow icon="volume-2" title={t('inAppSound')} right={<Toggle value={sound} onChange={(v) => onChange('inAppSound', v)} label={t('inAppSound')} />} />
          <MenuRow
            icon="clock"
            title={t('dailyReminder')}
            subtitle={reminder.on ? `${t('remindAt')} ${hourLabel(reminder.hour)}` : t('dailyReminderSub')}
            last={!reminder.on}
            right={<Toggle value={reminder.on} onChange={(v) => void saveReminder({ ...reminder, on: v })} label={t('dailyReminder')} />}
          />
          {reminder.on && (
            <View className="px-4 pb-4">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pl-[46px]">
                {REMINDER_HOURS.map((h) => (
                  <Chip key={h} text={hourLabel(h)} on={reminder.hour === h} onPress={() => void saveReminder({ ...reminder, hour: h })} />
                ))}
              </ScrollView>
            </View>
          )}
        </MenuGroup>
      </View>

      <View className="gap-2.5 pt-2">
        <View className="flex-row items-center gap-2 px-1">
          <Icon name="cloud" size={14} colorClassName="accent-muted-foreground" />
          <Text className="text-[13px] font-semibold text-foreground">{t('fromServer')}</Text>
        </View>
        <Muted className="px-1">{t('fromServerSub')}</Muted>
        <MenuGroup inset>
          <MenuRow
            icon="send"
            title={t('pushNotifications')}
            subtitle={on ? t('pushOnSub') : status === 'unavailable' ? undefined : t('pushOffSub')}
            last
            right={<Pill tone={on ? 'good' : status === 'denied' ? 'bad' : undefined} text={on ? 'ON' : 'OFF'} />}
            onPress={on ? undefined : () => (status === 'denied' ? void Linking.openSettings() : refresh())}
          />
        </MenuGroup>
      </View>
    </View>
  );
}
