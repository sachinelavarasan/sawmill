/** [OWNER-ONLY] Who can sign in: add, edit, enable / disable, reset a password. */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, ScrollView, Text, View } from 'react-native';
import { ScreenHeader } from '../../../../components/header';
import { Avatar, Button, Chip, EmptyState, ErrorBox, Muted, Pill, PressableCard, refresher, SearchBar, SkeletonList } from '../../../../components/ui';
import { dateTime } from '../../../../lib/format';
import { useT } from '../../../../lib/i18n';
import { useApi } from '../../../../lib/query';
import { useUser } from '../../../../lib/session';
import type { UserRow } from '../../../../lib/types';

export default function UsersScreen() {
  const t = useT();
  const router = useRouter();
  const me = useUser();
  const q = useApi<UserRow[]>('/users');
  const [search, setSearch] = useState('');
  const [show, setShow] = useState<'all' | 'active' | 'disabled'>('all');
  const needle = search.trim().toLowerCase();
  const items = (q.data ?? []).filter(
    (u) => (show === 'all' || (show === 'active') === u.isActive) && (!needle || `${u.name} ${u.username} ${u.phone ?? ''}`.toLowerCase().includes(needle)),
  );
  const add = () => router.push('/users/form');

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={t('users')} back right={<Button size="md" icon="user-plus" title={t('addAccountant')} onPress={add} className="mr-2" />} />
      <FlatList
        data={items}
        keyExtractor={(u) => u.id}
        contentContainerClassName="gap-2.5 p-4 pb-6"
        keyboardShouldPersistTaps="handled"
        refreshControl={refresher(q.isRefetching, () => void q.refetch())}
        ListHeaderComponent={
          <View className="gap-3 pb-1">
            <SearchBar value={search} onChange={setSearch} placeholder={t('searchUsers')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5">
              <Chip text={t('all')} on={show === 'all'} count={q.data?.length} onPress={() => setShow('all')} />
              <Chip text={t('active')} on={show === 'active'} onPress={() => setShow('active')} />
              <Chip text={t('disabled')} on={show === 'disabled'} onPress={() => setShow('disabled')} />
            </ScrollView>
            {q.error && <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
            {q.isPending && <SkeletonList rows={3} />}
          </View>
        }
        ListEmptyComponent={q.isPending ? null : <EmptyState icon="users" title={t('noUsersWithStatus')} />}
        renderItem={({ item: u }) => (
          <PressableCard onPress={() => router.push({ pathname: '/users/form', params: { id: u.id } })}>
            <View className="flex-row items-center gap-3">
              <Avatar name={u.name} />
              <View className="flex-1 gap-0.5">
                <Text className="text-[15px] font-bold text-foreground">
                  {u.name}
                  {u.id === me.id ? <Text className="text-xs font-semibold text-muted-foreground"> · {t('youTag')}</Text> : null}
                </Text>
                <Muted>
                  @{u.username}
                  {u.phone ? ` · ${u.phone}` : ''}
                </Muted>
              </View>
              <View className="items-end gap-1">
                <Pill text={t(u.role === 'OWNER' ? 'owner' : 'accountant')} tone={u.role === 'OWNER' ? 'info' : undefined} />
                {!u.isActive && <Pill tone="bad" text={t('disabled')} />}
              </View>
            </View>
            <Muted>
              {t('lastLogin')}: {u.lastLoginAt ? dateTime(u.lastLoginAt) : t('never')}
            </Muted>
          </PressableCard>
        )}
      />
    </View>
  );
}
