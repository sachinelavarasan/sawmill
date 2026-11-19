/**
 * Logged out. First launch on a phone shows a short welcome (what the app does, Get started);
 * after that it opens straight on Sign in. Navy brand band on top, the form on a rounded
 * surface rising from the bottom, the Sign in button always above the keyboard.
 */
import { Glow } from '../components/glow';
import { KeyboardView } from '../components/keyboard';
import { KEYS, getStored, setStored } from '../lib/storage';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark } from '../components/Brand';
import { Field } from '../components/form';
import { useStatusBar } from '../components/header';
import { Appear } from '../components/motion';
import { Text } from '../components/text';
import { Button, cn, ErrorBox, Icon, type IconName, LangPills, ThemeToggle } from '../components/ui';
import { ApiError } from '../lib/api';
import { useT } from '../lib/i18n';
import { useSession } from '../lib/session';


export default function LoginScreen() {
  // null until we know whether this phone has seen the welcome
  const [step, setStep] = useState<'welcome' | 'signin' | null>(null);
  // the band is dark in both themes (logging out from a light compact screen lands here)
  useStatusBar(true);
  useEffect(() => {
    getStored(KEYS.welcomed)
      .then((v) => setStep(v ? 'signin' : 'welcome'))
      .catch(() => setStep('signin'));
  }, []);

  if (!step) return <View className="flex-1 bg-hero" />;
  return step === 'welcome' ? (
    <Welcome
      onContinue={() => {
        setStored(KEYS.welcomed, '1').catch(() => undefined);
        setStep('signin');
      }}
    />
  ) : (
    <SignIn />
  );
}

function Feature({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View className="flex-row items-center gap-3.5">
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-hero-chip">
        <Icon name={icon} size={19} colorClassName="accent-saffron" />
      </View>
      <Text className="flex-1 text-[15px] font-medium text-hero-foreground">{text}</Text>
    </View>
  );
}

function Welcome({ onContinue }: { onContinue: () => void }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 overflow-hidden bg-hero" style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 20 }}>
      <Glow />
      <View className="flex-row justify-end px-4 pt-2">
        <ThemeToggle onDark />
      </View>
      <View className="flex-1 justify-center gap-12 px-7">
        <Appear index={0}>
          <BrandMark size="lg" tagline={t('appTagline')} />
        </Appear>
        <Appear index={2} className="gap-5">
          <Text className="text-[26px] font-bold leading-[32px] tracking-tight text-hero-foreground font-display">{t('welcomeHeadline')}</Text>
          <View className="gap-4">
            <Feature icon="ruler" text={t('loginFeature1')} />
            <Feature icon="check-circle" text={t('loginFeature2')} />
            <Feature icon="bar-chart-2" text={t('loginFeature3')} />
          </View>
        </Appear>
      </View>
      <Appear index={4} className="gap-3 px-6">
        <Button title={t('getStarted')} icon="arrow-right" onPress={onContinue} />
        <View className="items-center">
          <LangPills onDark />
        </View>
      </Appear>
    </View>
  );
}

function SignIn() {
  const t = useT();
  const { login } = useSession();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!username || !password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password); // the root layout then swaps to the app
    } catch (e) {
      const err = e as ApiError;
      setError(err.status === 401 ? t('loginWrong') : err.status === 429 || err.status === 423 ? t('loginLocked') : err.status === 0 ? (__DEV__ ? `${t('offline')} — ${err.message}` : t('offline')) : err.message);
      setBusy(false);
    }
  }

  return (
    <View className="flex-1 overflow-hidden bg-hero">
      <Glow />
      <KeyboardView>
        <ScrollView contentContainerClassName="grow" keyboardShouldPersistTaps="handled">
          {/* navy brand band: language + theme in the corners, the mark centred in the space left */}
          <View className="min-h-[260px] grow px-5 pb-10" style={{ paddingTop: insets.top + 8 }}>
            <View className="flex-row items-center justify-between">
              <LangPills onDark />
              <ThemeToggle onDark />
            </View>
            <Appear className="flex-1 items-center justify-center pt-6">
              <BrandMark size="lg" tagline={t('appTagline')} />
            </Appear>
          </View>

          {/* keep the Sign in button clear of Android's edge-to-edge navigation bar */}
          <Appear index={1} className="gap-5 rounded-t-[28px] bg-card px-6 pt-8">
            <View className="gap-1">
              <Text className="text-[26px] font-bold tracking-tight text-foreground font-display">{t('loginWelcome')}</Text>
              <Text className="text-[15px] text-muted-foreground">{t('loginSub')}</Text>
            </View>
            <Field
              label={t('username')}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              returnKeyType="next"
            />
            <View className="gap-2">
              <Field
                label={t('password')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!show}
                autoComplete="password"
                textContentType="password"
                onSubmitEditing={submit}
                returnKeyType="go"
              />
              <Pressable onPress={() => setShow((s) => !s)} accessibilityRole="button" className="min-h-10 flex-row items-center gap-1.5 self-end px-1">
                <Icon name={show ? 'eye-off' : 'eye'} size={16} colorClassName="accent-muted-foreground" />
                <Text className="text-[13px] font-semibold text-muted-foreground">{show ? t('hidePassword') : t('showPassword')}</Text>
              </Pressable>
            </View>

            {error && <ErrorBox message={error} />}
            <Button title={busy ? t('signingIn') : t('signIn')} icon={busy ? undefined : 'arrow-right'} onPress={submit} busy={busy} disabled={!username || !password} />
            <View style={{ height: 8 + insets.bottom }} />
          </Appear>
        </ScrollView>
      </KeyboardView>
    </View>
  );
}
