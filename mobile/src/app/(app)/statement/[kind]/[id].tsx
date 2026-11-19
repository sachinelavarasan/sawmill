/**
 * [OWNER-ONLY] A supplier's or client's statement (/statement/suppliers/:id, /statement/clients/:id):
 * every approved load billed to them and every payment against those loads, oldest first,
 * with the running balance. "Share" sends it as plain text (WhatsApp, SMS, email).
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Share, View } from 'react-native';
import { HeaderButton, Page, ScreenHeader } from '../../../../components/header';
import { modeKey } from '../../../../components/Payments';
import { Text } from '../../../../components/text';
import { cn, EmptyState, ErrorBox, KV, MenuGroup, Muted, SkeletonList, StatPair } from '../../../../components/ui';
import { dateOnly, inr, num3 } from '../../../../lib/format';
import { useT } from '../../../../lib/i18n';
import { useApi } from '../../../../lib/query';
import { useUser } from '../../../../lib/session';
import type { PartyStatement } from '../../../../lib/types';

export default function StatementScreen() {
  const { kind, id } = useLocalSearchParams<{ kind: 'suppliers' | 'clients'; id: string }>();
  const t = useT();
  const router = useRouter();
  const user = useUser();
  const q = useApi<PartyStatement>(`/${kind === 'clients' ? 'clients' : 'suppliers'}/${id}/statement`);
  const s = q.data;
  const isSupplier = kind !== 'clients';
  const paidLabel = t(isSupplier ? 'totalPaid' : 'totalReceived');

  const share = () => {
    if (!s) return;
    const lines = [
      `${user.mill.name} — ${t('statement')}`,
      s.party.name,
      '',
      ...s.entries.map((e) =>
        e.type === 'BILL'
          ? `${dateOnly(e.date)}  ${t('billEntry')} ${e.loadCode}  +${inr(e.amount)}  = ${inr(e.balance)}`
          : `${dateOnly(e.date)}  ${t('paymentEntry')} (${t(modeKey(e.mode!))}) ${e.loadCode}  −${inr(e.amount)}  = ${inr(e.balance)}`,
      ),
      '',
      `${t('billed')}: ${inr(s.totals.billed)}`,
      `${paidLabel}: ${inr(s.totals.paid)}`,
      `${t('balance')}: ${inr(s.totals.balance)}`,
    ];
    void Share.share({ title: `${t('statement')} — ${s.party.name}`, message: lines.join('\n') });
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader compact
        back
        title={s?.party.name ?? t('statement')}
        subtitle={t('statement')}
        right={s && s.entries.length > 0 ? <HeaderButton icon="share-2" label={t('shareStatement')} onPress={share} /> : null}
      />
      <Page compact refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
        {q.error && <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
        {!s && !q.error && <SkeletonList rows={4} />}
        {s && (
          <>
            {(s.party.phone || s.party.gstNumber) && <Muted>{[s.party.phone, s.party.gstNumber && `GST ${s.party.gstNumber}`].filter(Boolean).join(' · ')}</Muted>}
            <StatPair a={{ label: t('billed'), value: inr(s.totals.billed) }} b={{ label: paidLabel, value: inr(s.totals.paid) }} />
            <View className="rounded-xl bg-card px-4 py-3">
              <KV label={t('balance')} value={inr(s.totals.balance)} strong />
            </View>
            <Muted>{t('statementSub')}</Muted>
            {s.entries.length === 0 ? (
              <EmptyState icon="file-text" title={t('noStatement')} />
            ) : (
              <MenuGroup>
                {s.entries.map((e, i) => {
                  const bill = e.type === 'BILL';
                  return (
                    <View key={`${e.type}-${e.loadId}-${i}`} className={cn('min-h-[64px] flex-row items-center gap-3 px-4 py-3', i < s.entries.length - 1 && 'border-b border-border')}>
                      <View className="flex-1 gap-0.5">
                        <Text
                          className="text-[15px] font-semibold text-foreground"
                          numberOfLines={1}
                          onPress={() => router.push(`/${isSupplier ? 'imports' : 'exports'}/${e.loadId}`)}
                        >
                          {bill ? t('billEntry') : `${t('paymentEntry')} · ${t(modeKey(e.mode!))}`} · <Text className="text-[15px] font-semibold text-primary">{e.loadCode}</Text>
                        </Text>
                        <Muted lines={1}>{[dateOnly(e.date), bill && e.cft != null ? `${num3(e.cft)} CFT` : e.reference].filter(Boolean).join(' · ')}</Muted>
                      </View>
                      <View className="items-end">
                        <Text className={cn('text-[15px] font-bold tabular-nums', bill ? 'text-foreground' : 'text-success')}>
                          {bill ? '+' : '−'}
                          {inr(e.amount)}
                        </Text>
                        <Text className="text-[11px] tabular-nums text-muted-foreground">
                          {t('balance')} {inr(e.balance)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </MenuGroup>
            )}
          </>
        )}
      </Page>
    </View>
  );
}
