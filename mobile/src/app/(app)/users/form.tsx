/**
 * [OWNER-ONLY] Add an accountant, or edit someone (?id=): name, mobile, language,
 * enable / disable, reset password. The username never changes. Disabling or a password
 * reset ends that person's sessions at once (server rule).
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useConfirm, usePrompt } from '../../../components/confirm';
import { Field, FormScreen, FormSection, RequiredNote } from '../../../components/form';
import { toast } from '../../../components/toast';
import { Button, MenuGroup, MenuRow, Muted, Segmented } from '../../../components/ui';
import { api } from '../../../lib/api';
import { useSubmit, useUnsavedGuard } from '../../../lib/hooks';
import { useT } from '../../../lib/i18n';
import { invalidate, useApi } from '../../../lib/query';
import { useUser } from '../../../lib/session';
import type { UserRow } from '../../../lib/types';

const PASSWORD = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;
const USERNAME = /^[a-zA-Z0-9._-]{3,32}$/;
const PHONE = /^[0-9+ ]{7,15}$/;

export default function UserFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const t = useT();
  const router = useRouter();
  const me = useUser();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const users = useApi<UserRow[]>(id ? '/users' : null);
  const u = users.data?.find((x) => x.id === id);
  const EMPTY = { name: '', username: '', phone: '', password: '', preferredLanguage: 'en' as 'en' | 'ta' };
  const [initial, setInitial] = useState(EMPTY);
  const [f, setF] = useState(EMPTY);
  const [touched, setTouched] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (!u) return;
    const v = { ...EMPTY, name: u.name, username: u.username, phone: u.phone ?? '' };
    setInitial(v);
    setF(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [u?.id]);

  const errors = {
    name: f.name.trim().length >= 2 ? undefined : t('minChars', { n: 2 }),
    username: id || USERNAME.test(f.username) ? undefined : t('usernameHint'),
    phone: !f.phone.trim() || PHONE.test(f.phone.trim()) ? undefined : t('invalidMobile'),
    password: id || PASSWORD.test(f.password) ? undefined : t('passwordRule'),
  };
  const valid = !Object.values(errors).some(Boolean);
  const release = useUnsavedGuard(JSON.stringify(f) !== JSON.stringify(initial));

  const done = async (msg: string) => {
    await invalidate('/users', '/dashboard');
    toast(msg);
  };

  const [save, busy, error] = useSubmit(async () => {
    if (id) await api(`/users/${id}`, { method: 'PATCH', body: JSON.stringify({ name: f.name.trim(), phone: f.phone.trim() || undefined }) });
    else
      await api('/users', {
        method: 'POST',
        body: JSON.stringify({ name: f.name.trim(), username: f.username.trim(), phone: f.phone.trim() || undefined, password: f.password, role: 'ACCOUNTANT', preferredLanguage: f.preferredLanguage }),
      });
    release();
    await done(t('saved'));
    router.back();
  });

  const [toggle, toggling, toggleError] = useSubmit(async () => {
    if (!u) return;
    if (u.isActive && !(await confirm({ title: t('disableUserTitle'), message: t('disableUserBody'), confirmText: t('disable'), cancelText: t('cancel'), destructive: true }))) return;
    await api(`/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !u.isActive }) });
    await done(t(u.isActive ? 'userDisabledToast' : 'userEnabledToast', { name: u.name }));
  });

  const [reset, resetting, resetError] = useSubmit(async () => {
    if (!u) return;
    const pw = await prompt({ title: t('resetPassword'), message: `${t('resetPasswordBody')}\n${t('passwordRule')}`, placeholder: t('newPassword'), confirmText: t('resetPassword'), minLength: 8 });
    if (!pw) return;
    if (!PASSWORD.test(pw)) throw new Error(t('passwordRule'));
    await api(`/users/${u.id}/reset-password`, { method: 'POST', body: JSON.stringify({ password: pw }) });
    await done(t('saved'));
  });

  const set = (k: 'name' | 'username' | 'phone' | 'password') => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const self = u?.id === me.id;

  return (
    <FormScreen
      title={id ? t('editUser') : t('addAccountant')}
      subtitle={u ? `@${u.username}` : undefined}
      error={error ?? toggleError ?? resetError ?? (users.error as Error | null)?.message}
      footer={
        <Button
          title={t('save')}
          busy={busy}
          onPress={() => {
            setTouched(true);
            if (valid) void save();
          }}
        />
      }
    >
      <FormSection title={id ? t('editUser') : t('addAccountant')}>
        <Field label={t('name')} required value={f.name} onChangeText={set('name')} autoCapitalize="words" error={touched ? errors.name : undefined} />
        <Field
          label={t('username')}
          required={!id}
          value={f.username}
          onChangeText={set('username')}
          editable={!id}
          autoCapitalize="none"
          autoCorrect={false}
          hint={id ? t('usernameFixed') : t('usernameHint')}
          error={touched ? errors.username : undefined}
        />
        <Field label={t('mobile')} value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" error={errors.phone} />
        {!id && (
          <>
            <Field
              label={t('password')}
              required
              value={f.password}
              onChangeText={set('password')}
              secureTextEntry={!showPw}
              autoCapitalize="none"
              hint={t('passwordRule')}
              error={touched ? errors.password : undefined}
            />
            <Button size="md" kind="ghost" title={showPw ? t('hidePassword') : t('showPassword')} onPress={() => setShowPw((s) => !s)} />
            <View className="gap-1.5">
              <Muted>{t('myLanguage')}</Muted>
              <Segmented
                value={f.preferredLanguage}
                onChange={(preferredLanguage) => setF((x) => ({ ...x, preferredLanguage }))}
                options={[
                  { value: 'en', label: 'English' },
                  { value: 'ta', label: 'தமிழ்' },
                ]}
              />
            </View>
          </>
        )}
        <RequiredNote />
      </FormSection>

      {u && !self && (
        <MenuGroup>
          <MenuRow icon="key" title={resetting ? `${t('resetPassword')}…` : t('resetPassword')} subtitle={t('resetPasswordBody')} onPress={() => void reset()} />
          <MenuRow
            icon={u.isActive ? 'user-x' : 'user-check'}
            tone={u.isActive ? 'bad' : undefined}
            title={toggling ? '…' : t(u.isActive ? 'disable' : 'enable')}
            last
            onPress={() => void toggle()}
          />
        </MenuGroup>
      )}
    </FormScreen>
  );
}
