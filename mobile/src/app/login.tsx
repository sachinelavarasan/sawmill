import { useState } from 'react';
import { Image, KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Field } from '../components/form';
import { Button, ErrorBox, LangToggle, ThemeToggle } from '../components/ui';
import { ApiError } from '../lib/api';
import { useT } from '../lib/i18n';
import { useSession } from '../lib/session';

/** Slate hero with the TimberTrail mark, the form as a white sheet rising from the bottom. */
export default function LoginScreen() {
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
      setError(err.status === 401 ? t('loginWrong') : err.status === 429 || err.status === 423 ? t('loginLocked') : err.status === 0 ? t('offline') : err.message);
      setBusy(false);
    }
  }

  return (
    <View className="flex-1 bg-hero">
      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <ScrollView contentContainerClassName="grow" keyboardShouldPersistTaps="handled">
          <View className="min-h-[240px] grow items-center justify-center gap-2 px-8" style={{ paddingTop: insets.top + 24 }}>
            <Image source={require('../../assets/icon-dark.png')} className="mb-2 h-20 w-20" accessible={false} />
            <Text className="text-3xl font-bold tracking-wide text-hero-foreground">TimberTrail</Text>
            <Text className="text-[15px] text-hero-muted">{t('appTagline')}</Text>
          </View>

          {/* keep the Sign in button clear of Android's edge-to-edge navigation bar */}
          <View className="gap-4 rounded-t-3xl bg-card px-6 pt-7" style={{ paddingBottom: 32 + insets.bottom }}>
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1 gap-0.5">
                <Text className="text-[22px] font-bold text-foreground">{t('loginWelcome')}</Text>
                <Text className="text-[13px] text-muted-foreground">{t('loginSub')}</Text>
              </View>
              <ThemeToggle />
            </View>
            <LangToggle />

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
            <Text onPress={() => setShow((s) => !s)} accessibilityRole="button" className="-mt-2 self-end py-1 text-[13px] font-semibold text-primary">
              {show ? t('hidePassword') : t('showPassword')}
            </Text>

            {error && <ErrorBox message={error} />}
            <Button title={busy ? t('signingIn') : t('signIn')} onPress={submit} busy={busy} disabled={!username || !password} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
