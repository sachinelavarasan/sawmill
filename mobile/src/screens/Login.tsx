import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, Profile } from '../api';
import { useTheme } from '../theme';
import { LangToggle, ThemeToggle, useStyles, useT } from '../ui';

export function LoginScreen({ onLoggedIn }: { onLoggedIn: (p: Profile) => void }) {
  const t = useT();
  const { c } = useTheme();
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [focused, setFocused] = useState<'username' | 'password' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!username || !password) return;
    setBusy(true);
    setError(null);
    try {
      onLoggedIn(await auth.login(username.trim(), password));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={[s.fill, { backgroundColor: c.hero }]} edges={['top']}>
      <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.loginScroll} keyboardShouldPersistTaps="handled">
          <View style={s.loginHero}>
            <Image source={require('../../assets/icon-dark.png')} style={s.brandMarkLarge} accessible={false} />
            <Text style={s.loginTitle}>TimberTrail</Text>
            <Text style={s.loginTagline}>{t('appTagline')}</Text>
          </View>

          {/* keep the Sign in button clear of Android's edge-to-edge navigation bar */}
          <View style={[s.loginCard, { paddingBottom: 36 + insets.bottom }]}>
            <View style={s.rowBetween}>
              <Text style={s.h2}>{t('login')}</Text>
              <View style={s.row}>
                <ThemeToggle />
                <LangToggle />
              </View>
            </View>

            <View style={s.field}>
              <Text style={s.label}>{t('username')}</Text>
              <TextInput
                style={[s.input, focused === 'username' && s.inputFocused]}
                value={username}
                onChangeText={setUsername}
                onFocus={() => setFocused('username')}
                onBlur={() => setFocused(null)}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                accessibilityLabel={t('username')}
              />
            </View>
            <View style={s.field}>
              <Text style={s.label}>{t('password')}</Text>
              <TextInput
                style={[s.input, focused === 'password' && s.inputFocused]}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                secureTextEntry
                autoComplete="password"
                onSubmitEditing={submit}
                accessibilityLabel={t('password')}
              />
            </View>

            {error && <Text style={s.error}>{error}</Text>}
            <Pressable style={[s.btnPrimary, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy} accessibilityRole="button">
              <Text style={s.btnPrimaryText}>{busy ? t('signingIn') : t('signIn')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
