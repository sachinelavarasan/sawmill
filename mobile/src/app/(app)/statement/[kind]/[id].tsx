/**
 * [OWNER-ONLY] Business partner detail & statement (/statement/suppliers/:id, /statement/clients/:id):
 * profile details, financial summary, and transaction history with navigation to loads and share.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Share, View } from 'react-native';
import { HeaderButton, Page, ScreenHeader } from '../../../../components/header';
import { BusinessPartnerFinancialSummary } from '../../../../components/partners/BusinessPartnerFinancialSummary';
import { BusinessPartnerProfile } from '../../../../components/partners/BusinessPartnerProfile';
import { BusinessPartnerTransactionHistory } from '../../../../components/partners/BusinessPartnerTransactionHistory';
import { PARTNER_META, type PartnerKind } from '../../../../components/partners/types';
import { modeKey } from '../../../../components/Payments';
import { ErrorBox, SkeletonList } from '../../../../components/ui';
import { dateOnly, inr } from '../../../../lib/format';
import { useT } from '../../../../lib/i18n';
import { useApi } from '../../../../lib/query';
import { useUser } from '../../../../lib/session';
import type { Party, PartyStatement } from '../../../../lib/types';

export default function StatementScreen() {
  const { kind, id } = useLocalSearchParams<{ kind: 'suppliers' | 'clients'; id: string }>();
  const partnerKind: PartnerKind = kind === 'clients' ? 'clients' : 'suppliers';
  const meta = PARTNER_META[partnerKind];
  const t = useT();
  const router = useRouter();
  const user = useUser();

  const q = useApi<PartyStatement>(`/${partnerKind}/${id}/statement`);
  const list = useApi<Party[]>(`/${partnerKind}`);
  const s = q.data;
  const notes = list.data?.find((p) => p.id === id)?.notes ?? null;

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
      `${t(meta.paidLabel)}: ${inr(s.totals.paid)}`,
      `${t('balance')}: ${inr(s.totals.balance)}`,
    ];
    void Share.share({ title: `${t('statement')} — ${s.party.name}`, message: lines.join('\n') });
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        compact
        back
        title={s?.party.name ?? t(meta.singular)}
        subtitle={t(meta.singular)}
        right={
          <View className="flex-row items-center">
            <HeaderButton
              icon="edit-2"
              label={t('edit')}
              onPress={() => router.push({ pathname: '/parties/form', params: { kind: partnerKind, id } })}
            />
            {s && s.entries.length > 0 && (
              <HeaderButton icon="share-2" label={t('shareStatement')} onPress={share} />
            )}
          </View>
        }
      />
      <Page compact refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
        {q.error && <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
        {!s && !q.error && <SkeletonList rows={4} />}
        {s && (
          <View className="gap-4">
            <BusinessPartnerProfile
              kind={partnerKind}
              name={s.party.name}
              phone={s.party.phone}
              gstNumber={s.party.gstNumber}
              address={s.party.address}
              notes={notes}
            />
            <BusinessPartnerFinancialSummary
              kind={partnerKind}
              billed={s.totals.billed}
              paid={s.totals.paid}
              balance={s.totals.balance}
            />
            <BusinessPartnerTransactionHistory kind={partnerKind} entries={s.entries} />
          </View>
        )}
      </Page>
    </View>
  );
}
