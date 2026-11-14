import { useRouter } from 'expo-router';
import { Permission } from '@sawmill/shared';
import { Page, ScreenHeader } from '../../../../components/header';
import { MenuGroup, MenuRow, Muted } from '../../../../components/ui';
import { useT } from '../../../../lib/i18n';
import { TRANSACTION_ITEMS, visible } from '../../../../lib/nav';
import { useApi } from '../../../../lib/query';
import { useSession } from '../../../../lib/session';

/** Transactions: every kind of entry, in the order the wood moves through the mill. */
export default function TransactionsHome() {
  const t = useT();
  const router = useRouter();
  const { can } = useSession();
  const pending = useApi<{ total: number }>(can(Permission.OPERATIONS_APPROVE) ? '/approvals/count' : null);
  const items = TRANSACTION_ITEMS.filter((i) => visible(i, can));
  return (
    <>
      <ScreenHeader title={t('transactions')} large />
      <Page bottomInset={false}>
        <Muted>{t('transactionsSub')}</Muted>
        <MenuGroup>
          {items.map((i, n) => (
            <MenuRow
              key={i.key}
              icon={i.icon}
              title={t(i.labelKey)}
              subtitle={i.subKey ? t(i.subKey) : undefined}
              badge={i.key === 'approvals' ? pending.data?.total : undefined}
              last={n === items.length - 1}
              onPress={() => router.push(i.href as never)}
            />
          ))}
        </MenuGroup>
      </Page>
    </>
  );
}
