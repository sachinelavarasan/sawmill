import { Feather } from '@expo/vector-icons';
import { Permission, type Lang } from '@sawmill/shared';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, Profile, setSessionLostHandler } from './api';
import { NavProvider, Tab, useNav } from './nav';
import { HomeScreen } from './screens/Home';
import { ImportDetailScreen } from './screens/ImportDetail';
import { ImportFormScreen } from './screens/ImportForm';
import { ImportsList } from './screens/Imports';
import { LoginScreen } from './screens/Login';
import { MeasureScreen } from './screens/Measure';
import { ThemeProvider, useTheme } from './theme';
import { LangCtx, LangToggle, ThemeToggle, useStyles, useT } from './ui';

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Root />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function Root() {
  const { c } = useTheme();
  const s = useStyles();
  const [lang, setLang] = useState<Lang>('en');
  const [user, setUser] = useState<Profile | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    setSessionLostHandler(() => setUser(null));
    auth
      .restore()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setBooting(false));
  }, []);

  return (
    <LangCtx.Provider value={{ lang, setLang }}>
      {/* the app bar is dark green in both themes, so status-bar icons stay light */}
      <StatusBar style="light" />
      {booting ? (
        <View style={[s.fill, s.center, { backgroundColor: c.hero }]}>
          <ActivityIndicator color={c.heroText} size="large" />
        </View>
      ) : user ? (
        <NavProvider>
          <Shell
            user={user}
            onLogout={async () => {
              await auth.logout();
              setUser(null);
            }}
          />
        </NavProvider>
      ) : (
        <LoginScreen
          onLoggedIn={(p) => {
            if (p.preferredLanguage === 'ta' || p.preferredLanguage === 'en') setLang(p.preferredLanguage);
            setUser(p);
          }}
        />
      )}
    </LangCtx.Provider>
  );
}

/** Logged-in app: a pushed screen if any, otherwise the current tab with app bar + bottom tabs. */
function Shell({ user, onLogout }: { user: Profile; onLogout: () => void }) {
  const t = useT();
  const { c } = useTheme();
  const s = useStyles();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const canOperate = user.permissions.includes(Permission.OPERATIONS_CREATE);
  const isOwner = user.permissions.includes(Permission.DASHBOARD_OWNER);

  const top = nav.stack[nav.stack.length - 1];
  if (top) {
    // key forces a fresh screen per route, so each one loads its own data
    switch (top.name) {
      case 'newImport':
        return <ImportFormScreen key="new" />;
      case 'editImport':
        return <ImportFormScreen key={`edit-${top.id}`} id={top.id} />;
      case 'import':
        return <ImportDetailScreen key={`imp-${top.id}`} id={top.id} />;
      case 'measure':
        return <MeasureScreen key={`m-${top.id}`} id={top.id} />;
    }
  }

  const tabs: { key: Tab; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { key: 'home', label: t('home'), icon: 'home' },
    ...(canOperate
      ? ([
          { key: 'imports', label: t('imports'), icon: 'download' },
          { key: 'measure', label: t('measure'), icon: 'edit-3' },
        ] as const)
      : []),
  ];

  return (
    <SafeAreaView style={[s.fill, { backgroundColor: c.hero }]} edges={['top']}>
      <View style={s.header}>
        <View style={s.brandMark}>
          <Text style={s.brandMarkText}>SP</Text>
        </View>
        <View style={s.fill}>
          <Text style={s.headerTitle} numberOfLines={1}>
            {user.mill.name}
          </Text>
          <Text style={s.headerSub} numberOfLines={1}>
            {user.name} · {isOwner ? t('owner') : t('accountant')}
          </Text>
        </View>
        <LangToggle onHero />
        <ThemeToggle onHero />
        <Pressable onPress={onLogout} style={[s.iconBtn, s.iconBtnHero]} accessibilityRole="button" accessibilityLabel={t('logout')}>
          <Feather name="log-out" size={20} color={c.heroText} />
        </Pressable>
      </View>

      <View style={[s.fill, { backgroundColor: c.bg }, tabs.length <= 1 && { paddingBottom: insets.bottom }]}>
        {nav.tab === 'home' && <HomeScreen user={user} />}
        {nav.tab === 'imports' && <ImportsList mode="all" />}
        {nav.tab === 'measure' && <ImportsList mode="open" />}
      </View>

      {tabs.length > 1 && (
        <View style={[s.tabBar, { paddingBottom: insets.bottom }]} accessibilityRole="tablist">
          {tabs.map((tb) => {
            const on = nav.tab === tb.key;
            return (
              <Pressable
                key={tb.key}
                onPress={() => nav.setTab(tb.key)}
                style={s.tab}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
              >
                <View style={[s.tabPill, on && s.tabPillOn]}>
                  <Feather name={tb.icon} size={20} color={on ? c.primary : c.muted} />
                </View>
                <Text style={[s.tabText, on && s.tabTextOn]}>{tb.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </SafeAreaView>
  );
}
