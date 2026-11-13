import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { ImportSummary, importsApi } from '../imports-api';
import { useNav } from '../nav';
import { useTheme } from '../theme';
import { dateTime, ErrorBox, Loading, num3, StatusPill, useStyles, useT } from '../ui';

/**
 * `mode="all"`: the Imports tab (every load I can see, with a New button).
 * `mode="open"`: the Measurement tab (only Draft/Rejected loads, tap to measure).
 */
export function ImportsList({ mode }: { mode: 'all' | 'open' }) {
  const t = useT();
  const { c } = useTheme();
  const s = useStyles();
  const nav = useNav();
  const [items, setItems] = useState<ImportSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      setItems((await importsApi.list({ open: mode === 'open' })).items);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, [mode]);

  useEffect(() => {
    load();
  }, [load, nav.version]);

  return (
    <View style={[s.fill, { backgroundColor: c.bg }]}>
      <FlatList
        data={items ?? []}
        keyExtractor={(i) => i.id}
        contentContainerStyle={[s.body, { paddingBottom: 96 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} tintColor={c.primary} colors={[c.primary]} progressBackgroundColor={c.surface} />
        }
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <Text style={s.h1}>{mode === 'open' ? t('measurement') : t('imports')}</Text>
            {error && <ErrorBox message={error} onRetry={load} />}
            {!items && !error && <Loading />}
          </View>
        }
        ListEmptyComponent={
          items ? <Text style={s.muted}>{mode === 'open' ? t('noOpenLoads') : t('noImports')}</Text> : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => nav.push(mode === 'open' ? { name: 'measure', id: item.id } : { name: 'import', id: item.id })}
            style={({ pressed }) => [s.card, pressed && { backgroundColor: c.surface2 }]}
            accessibilityRole="button"
          >
            <View style={s.rowBetween}>
              <Text style={s.cardTitle}>{item.code}</Text>
              <StatusPill status={item.status} />
            </View>
            <Text style={s.muted}>
              {t('lorry')} {item.lorryNumber} · {item.woodType} · {dateTime(item.arrivalAt)}
            </Text>
            <View style={s.rowBetween}>
              <View style={s.statRow}>
                <Text style={s.statText}>
                  <Text style={s.statStrong}>{item.totalLogs}</Text> {t('logs')}
                </Text>
                <Text style={s.statText}>
                  <Text style={s.statStrong}>{num3(item.totalCft)}</Text> CFT
                </Text>
              </View>
              {mode === 'open' ? (
                <View style={s.row}>
                  <Text style={[s.cardTitle, { color: c.primary }]}>{t('measure')}</Text>
                  <Feather name="chevron-right" size={18} color={c.primary} />
                </View>
              ) : (
                <Feather name="chevron-right" size={18} color={c.muted} />
              )}
            </View>
            {!!item.rejectionReason && <Text style={s.reason}>{item.rejectionReason}</Text>}
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />

      {mode === 'all' && (
        <Pressable style={s.fab} onPress={() => nav.push({ name: 'newImport' })} accessibilityRole="button">
          <Feather name="plus" size={20} color={c.onPrimary} />
          <Text style={s.fabText}>{t('newImport')}</Text>
        </Pressable>
      )}
    </View>
  );
}
