import { EyeIcon, EyeOffIcon, KeyRoundIcon, MoreVerticalIcon, PencilIcon, PlusIcon, ShieldCheckIcon, UserCheckIcon, UserXIcon } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { api } from '../api';
import { useAuth } from '../auth';
import { dateTime, useApi } from '../components/common';
import { useConfirm } from '../components/confirm';
import { type Column, DataTable } from '../components/data-table';
import { Field, FigureStrip, FilterChips, FormGrid, LoadState, Notice, Page, PageHeader, SearchBox } from '../components/page';
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
  createdAt: string;
}

type StatusFilter = 'ALL' | 'ACTIVE' | 'DISABLED';

const pill = 'rounded-full border-transparent font-semibold';
const dateOnly = (s: string) => new Date(s).toLocaleDateString('en-IN', { dateStyle: 'medium' });

export function UsersPage() {
  const { t } = useI18n();
  const { user: me } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const { data, loading, error, reload } = useApi<UserRow[]>('/users');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [resetFor, setResetFor] = useState<UserRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // the whole list is loaded, so it is searched and filtered right here
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');

  const users = data ?? [];
  const active = users.filter((u) => u.isActive).length;
  const shown = useMemo(() => {
    const needle = q.toLowerCase();
    return (data ?? []).filter(
      (u) => (status === 'ALL' || (status === 'ACTIVE') === u.isActive) && (!needle || [u.name, u.username, u.phone].some((v) => v?.toLowerCase().includes(needle))),
    );
  }, [data, q, status]);

  /** Enable at once; disabling signs the person out, so it is confirmed first. */
  async function setActive(u: UserRow, isActive: boolean) {
    if (!isActive && !(await confirm({ title: t('disableUserTitle', { name: u.name }), description: t('disableUserBody'), confirmLabel: t('disable'), destructive: true }))) return;
    setActionError(null);
    try {
      await api(`/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ isActive }) });
      toast(t(isActive ? 'userEnabledToast' : 'userDisabledToast', { name: u.name }), isActive ? 'ok' : 'info');
      reload();
    } catch (e) {
      setActionError((e as Error).message);
    }
  }

  const meId = me?.id;
  const columns = useMemo((): Column<UserRow>[] => {
    const roleBadge = (u: UserRow) => (
      <Badge variant="secondary" className={cn(pill, 'gap-1', u.role === 'OWNER' ? 'bg-primary-soft text-primary' : 'bg-muted text-muted-foreground')}>
        {u.role === 'OWNER' && <ShieldCheckIcon aria-hidden />}
        {u.role === 'OWNER' ? t('owner') : t('accountant')}
      </Badge>
    );
    const statusBadge = (u: UserRow) => (
      <Badge variant="secondary" className={cn(pill, 'gap-1.5 py-1 pr-2.5 pl-2', u.isActive ? 'bg-success-soft text-success' : 'bg-destructive-soft text-destructive')}>
        <span className="size-1.5 rounded-full bg-current" aria-hidden />
        {u.isActive ? t('active') : t('disabled')}
      </Badge>
    );
    return [
      {
        id: 'name',
        header: t('user'),
        sort: (u) => u.name.toLowerCase(),
        cell: (u) => (
          <div className={cn('flex items-center gap-3', !u.isActive && 'opacity-60')}>
            <Avatar size="sm">
              <AvatarFallback className="bg-primary-soft text-xs font-semibold text-primary">{u.name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-semibold">
                <span className="truncate">{u.name}</span>
                {u.id === meId && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.6875rem] leading-none font-medium text-muted-foreground">{t('youTag')}</span>}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                @{u.username}
                <span className="md:hidden">{u.phone && ` · ${u.phone}`}</span>
              </div>
              <div className="mt-1 sm:hidden">{roleBadge(u)}</div>
            </div>
          </div>
        ),
      },
      { id: 'phone', header: t('mobile'), from: 'md', className: 'tabular-nums', cell: (u) => u.phone ?? '—' },
      { id: 'role', header: t('role'), from: 'sm', sort: (u) => u.role, cell: roleBadge },
      { id: 'status', header: t('status'), sort: (u) => (u.isActive ? 0 : 1), cell: statusBadge },
      { id: 'created', header: t('createdOn'), from: 'md', sort: (u) => Date.parse(u.createdAt), className: 'text-muted-foreground', cell: (u) => dateOnly(u.createdAt) },
      {
        id: 'lastLogin',
        header: t('lastLogin'),
        from: 'md',
        sort: (u) => (u.lastLoginAt ? Date.parse(u.lastLoginAt) : null),
        className: 'text-muted-foreground',
        cell: (u) => (u.lastLoginAt ? dateTime(u.lastLoginAt) : t('never')),
      },
      {
        id: 'actions',
        header: <span className="sr-only">{t('actions')}</span>,
        className: 'w-px text-right',
        cell: (u) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label={t('userActions', { name: u.name })}>
                <MoreVerticalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuItem onSelect={() => setEditing(u)}>
                <PencilIcon /> {t('edit')}
              </DropdownMenuItem>
              {/* as before: the owner's own password and status are not changed from this screen */}
              {u.id !== meId && (
                <>
                  <DropdownMenuItem onSelect={() => setResetFor(u)}>
                    <KeyRoundIcon /> {t('resetPassword')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {u.isActive ? (
                    <DropdownMenuItem variant="destructive" onSelect={() => setActive(u, false)}>
                      <UserXIcon /> {t('disable')}
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onSelect={() => setActive(u, true)}>
                      <UserCheckIcon /> {t('enable')}
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ];
    // setActive only reads its arguments and stable helpers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, meId]);

  return (
    <Page>
      <PageHeader
        title={t('users')}
        subtitle={t('usersSub')}
        actions={
          <Button onClick={() => setShowForm(true)}>
            <PlusIcon /> {t('addAccountant')}
          </Button>
        }
      />

      {actionError && <Notice tone="error">{actionError}</Notice>}
      <LoadState loading={loading && !data} error={error} onRetry={reload} />

      {data && (
        <>
          <FigureStrip
            items={[
              { label: t('totalUsers'), value: users.length },
              { label: t('active'), value: active, tone: 'good' },
              { label: t('disabled'), value: users.length - active, tone: users.length - active ? 'bad' : undefined },
              { label: t('accountant'), value: users.filter((u) => u.role === 'ACCOUNTANT').length },
            ]}
          />

          {/* not re-keyed on filter changes: the search box lives in the toolbar and must keep its focus */}
          <DataTable
            data={shown}
            columns={columns}
            rowKey={(u) => u.id}
            empty={q ? t('noMatches', { q }) : t('noUsersWithStatus')}
            busy={loading}
            toolbar={
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <SearchBox className="sm:w-80 [&_input]:h-9" value={q} onChange={setQ} placeholder={t('searchUsers')} />
                <FilterChips
                  className="sm:ml-auto"
                  label={t('status')}
                  value={status}
                  onChange={setStatus}
                  options={[
                    { value: 'ALL', label: t('all') },
                    { value: 'ACTIVE', label: t('active'), dot: 'bg-success' },
                    { value: 'DISABLED', label: t('disabled'), dot: 'bg-destructive' },
                  ]}
                />
              </div>
            }
          />
        </>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        {showForm && (
          <CreateUserForm
            onDone={(ok) => {
              setShowForm(false);
              if (ok) {
                toast(t('saved'));
                reload();
              }
            }}
          />
        )}
      </Dialog>
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        {editing && (
          <EditUserForm
            user={editing}
            onDone={(ok) => {
              setEditing(null);
              if (ok) {
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
              if (ok) toast(t('saved'));
            }}
          />
        )}
      </Dialog>
    </Page>
  );
}

/** A password box with a show / hide button: a password typed for someone else is worth reading back. */
function PasswordInput({ id, value, onChange, autoFocus }: { id: string; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const { t } = useI18n();
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={shown ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} required autoComplete="new-password" autoFocus={autoFocus} className="pr-10" />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? t('hidePassword') : t('showPassword')}
        title={shown ? t('hidePassword') : t('showPassword')}
        aria-pressed={shown}
        className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        {shown ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
      </button>
    </div>
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
      <form onSubmit={submit} className="grid gap-5">
        <DialogHeader>
          <DialogTitle>{t('addAccountant')}</DialogTitle>
          <DialogDescription>{t('requiredNote')}</DialogDescription>
        </DialogHeader>
        <FormGrid className="lg:grid-cols-2">
          <Field id="user-name" label={t('name')} required>
            <Input id="user-name" value={form.name} onChange={set('name')} required minLength={2} autoFocus />
          </Field>
          <Field label={t('role')} required>
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
          <Field id="user-username" label={t('username')} required hint={t('usernameHint')} className="sm:col-span-full">
            <Input id="user-username" value={form.username} onChange={set('username')} required autoCapitalize="none" autoComplete="off" />
          </Field>
          <Field id="user-phone" label={t('mobile')} hint={t('mobileHint')} className="sm:col-span-full">
            <Input id="user-phone" type="tel" value={form.phone} onChange={set('phone')} inputMode="tel" autoComplete="off" />
          </Field>
          <Field id="user-password" label={t('password')} required hint={t('passwordRule')} className="sm:col-span-full">
            <PasswordInput id="user-password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
          </Field>
        </FormGrid>
        {error && <Notice tone="error">{error}</Notice>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onDone(false)}>
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

/** Name and mobile only: the username is fixed, and role, status and password have their own actions and rules. */
function EditUserForm({ user, onDone }: { user: UserRow; onDone: (ok: boolean) => void }) {
  const { t } = useI18n();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // the API has no way to clear a mobile number, so an emptied box leaves it as it was
      await api(`/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ name, phone: phone || undefined }) });
      onDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogContent className="sm:max-w-md">
      <form onSubmit={submit} className="grid gap-5">
        <DialogHeader>
          <DialogTitle>{t('editUser')}</DialogTitle>
          <DialogDescription>@{user.username}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field id="edit-user-name" label={t('name')} required>
            <Input id="edit-user-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={100} autoFocus />
          </Field>
          <Field id="edit-user-username" label={t('username')} hint={t('usernameFixed')}>
            <Input id="edit-user-username" value={user.username} readOnly disabled />
          </Field>
          <Field id="edit-user-phone" label={t('mobile')} hint={t('mobileHint')}>
            <Input id="edit-user-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="off" />
          </Field>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onDone(false)}>
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
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/users/${user.id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) });
      onDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogContent className="sm:max-w-md">
      <form onSubmit={submit} className="grid gap-5">
        <DialogHeader>
          <DialogTitle>{t('resetPassword')}</DialogTitle>
          <DialogDescription>{t('resetPasswordBody', { name: user.name, username: user.username })}</DialogDescription>
        </DialogHeader>
        <Field id="reset-password" label={t('newPassword')} required hint={t('passwordRule')}>
          <PasswordInput id="reset-password" value={password} onChange={setPassword} autoFocus />
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onDone(false)}>
            {t('cancel')}
          </Button>
          <Button type="submit" disabled={busy}>
            <KeyRoundIcon /> {t('resetPassword')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
