import { KeyRoundIcon, PlusIcon } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { api } from '../api';
import { useAuth } from '../auth';
import { dateTime, useApi } from '../components/common';
import { type Column, DataTable } from '../components/data-table';
import { Field, FormGrid, LoadState, Notice, Page, PageHeader } from '../components/page';
import { useToast } from '../components/toast';
import { useI18n } from '../i18n';

interface UserRow {
  id: string;
  name: string;
  username: string;
  phone: string | null;
  role: 'OWNER' | 'ACCOUNTANT';
  isActive: boolean;
  lastLoginAt: string | null;
}

const pill = 'rounded-full border-transparent font-semibold';

export function UsersPage() {
  const { t } = useI18n();
  const { user: me } = useAuth();
  const { data, loading, error, reload } = useApi<UserRow[]>('/users');
  const [showForm, setShowForm] = useState(false);
  const [resetFor, setResetFor] = useState<UserRow | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const toast = useToast();

  async function toggleActive(u: UserRow) {
    setMessage(null);
    try {
      await api(`/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !u.isActive }) });
      reload();
    } catch (e) {
      setMessage({ kind: 'error', text: (e as Error).message });
    }
  }

  const meId = me?.id;
  const columns = useMemo((): Column<UserRow>[] => {
    const roleBadge = (u: UserRow) => (
      <Badge variant="secondary" className={cn(pill, u.role === 'OWNER' ? 'bg-primary-soft text-primary' : 'bg-muted text-muted-foreground')}>
        {u.role === 'OWNER' ? t('owner') : t('accountant')}
      </Badge>
    );
    return [
      {
        id: 'name',
        header: t('name'),
        sort: (u) => u.name.toLowerCase(),
        cell: (u) => (
          <div className="flex items-center gap-3">
            <Avatar size="sm" className="max-sm:hidden">
              <AvatarFallback className="bg-primary-soft text-xs font-semibold text-primary">{u.name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-semibold">{u.name}</div>
              <div className="text-xs text-muted-foreground md:hidden">
                {u.username}
                {u.phone && ` · ${u.phone}`}
              </div>
              <div className="mt-1 sm:hidden">{roleBadge(u)}</div>
            </div>
          </div>
        ),
      },
      { id: 'username', header: t('username'), from: 'md', sort: (u) => u.username.toLowerCase(), cell: (u) => u.username },
      { id: 'phone', header: t('mobile'), from: 'md', cell: (u) => u.phone ?? '—' },
      { id: 'role', header: t('role'), from: 'sm', sort: (u) => u.role, cell: roleBadge },
      {
        id: 'status',
        header: t('status'),
        cell: (u) => (
          <div className="inline-flex items-center gap-2">
            {u.id !== meId && (
              <Switch checked={u.isActive} onCheckedChange={() => toggleActive(u)} aria-label={u.isActive ? t('disable') : t('enable')} title={u.isActive ? t('disable') : t('enable')} />
            )}
            <Badge variant="secondary" className={cn(pill, u.isActive ? 'bg-success-soft text-success' : 'bg-destructive-soft text-destructive')}>
              {u.isActive ? t('active') : t('disabled')}
            </Badge>
          </div>
        ),
      },
      {
        id: 'lastLogin',
        header: t('lastLogin'),
        from: 'md',
        sort: (u) => (u.lastLoginAt ? Date.parse(u.lastLoginAt) : null),
        className: 'text-muted-foreground',
        cell: (u) => (u.lastLoginAt ? dateTime(u.lastLoginAt) : t('never')),
      },
      {
        id: 'reset',
        className: 'text-right',
        cell: (u) =>
          u.id !== meId && (
            <Button variant="outline" size="sm" onClick={() => setResetFor(u)} aria-label={t('resetPassword')}>
              <KeyRoundIcon />
              <span className="max-md:sr-only">{t('resetPassword')}</span>
            </Button>
          ),
      },
    ];
    // toggleActive only reads its argument and stable setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, meId]);

  return (
    <Page>
      <PageHeader
        title={t('users')}
        actions={
          <Button onClick={() => setShowForm(true)}>
            <PlusIcon /> {t('addAccountant')}
          </Button>
        }
      />

      {message && <Notice tone={message.kind}>{message.text}</Notice>}
      <LoadState loading={loading && !data} error={error} onRetry={reload} />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        {showForm && (
          <CreateUserForm
            onDone={(ok) => {
              setShowForm(false);
              if (ok) {
                setMessage(null);
                toast(t('saved'));
                reload();
              }
            }}
          />
        )}
      </Dialog>
      <Dialog open={!!resetFor} onOpenChange={(open) => !open && setResetFor(null)}>
        {resetFor && (
          <ResetPasswordForm
            user={resetFor}
            onDone={(ok) => {
              setResetFor(null);
              if (ok) {
                setMessage(null);
                toast(t('saved'));
              }
            }}
          />
        )}
      </Dialog>

      {data && <DataTable data={data} columns={columns} rowKey={(u) => u.id} empty={t('noData')} busy={loading} />}
    </Page>
  );
}

function CreateUserForm({ onDone }: { onDone: (ok: boolean) => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ name: '', username: '', phone: '', password: '', role: 'ACCOUNTANT' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/users', {
        method: 'POST',
        body: JSON.stringify({ ...form, phone: form.phone || undefined }),
      });
      onDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogContent className="sm:max-w-lg">
      <form onSubmit={submit} className="grid gap-4">
        <DialogHeader>
          <DialogTitle>{t('addAccountant')}</DialogTitle>
        </DialogHeader>
        <FormGrid className="lg:grid-cols-2">
          <Field id="user-name" label={t('name')}>
            <Input id="user-name" value={form.name} onChange={set('name')} required minLength={2} autoFocus />
          </Field>
          <Field id="user-username" label={t('username')}>
            <Input id="user-username" value={form.username} onChange={set('username')} required autoCapitalize="none" />
          </Field>
          <Field id="user-phone" label={t('mobile')}>
            <Input id="user-phone" value={form.phone} onChange={set('phone')} inputMode="tel" />
          </Field>
          <Field label={t('role')}>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger className="w-full" aria-label={t('role')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACCOUNTANT">{t('accountant')}</SelectItem>
                <SelectItem value="OWNER">{t('owner')}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field id="user-password" label={t('password')} hint={t('passwordRule')} className="sm:col-span-full">
            <Input id="user-password" type="password" value={form.password} onChange={set('password')} required autoComplete="new-password" />
          </Field>
        </FormGrid>
        {error && <Notice tone="error">{error}</Notice>}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onDone(false)}>
            {t('cancel')}
          </Button>
          <Button type="submit" disabled={busy}>
            {t('save')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function ResetPasswordForm({ user, onDone }: { user: UserRow; onDone: (ok: boolean) => void }) {
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api(`/users/${user.id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) });
      onDone(true);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <DialogContent className="sm:max-w-md">
      <form onSubmit={submit} className="grid gap-4">
        <DialogHeader>
          <DialogTitle>{t('resetPassword')}</DialogTitle>
          <DialogDescription>{user.name}</DialogDescription>
        </DialogHeader>
        <Field id="reset-password" label={t('newPassword')} hint={t('passwordRule')}>
          <Input
            id="reset-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            autoFocus
          />
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onDone(false)}>
            {t('cancel')}
          </Button>
          <Button type="submit">{t('save')}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
