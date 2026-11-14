import { sizeLabel } from '@sawmill/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { HeaderButton, Page, ScreenHeader } from '../../../../components/header';
import { Card, ErrorBox, KV, Muted, Reason, SkeletonList, StatPair, StatusPill } from '../../../../components/ui';
import { WorkflowBar } from '../../../../components/workflow';
import { dateTime, signed3, signedInt } from '../../../../lib/format';
import { useT } from '../../../../lib/i18n';
import { useApi } from '../../../../lib/query';
import type { Adjustment } from '../../../../lib/types';

export default function AdjustmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const router = useRouter();
  const q = useApi<Adjustment>(`/stock-adjustments/${id}`);
  const a = q.data;
  const change = a ? `${signed3(a.cftDelta)} CFT${a.piecesDelta ? ` (${signedInt(a.piecesDelta)} ${t('pieces')})` : ''}` : '';
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        back
        title={a?.code ?? t('adjustments')}
        subtitle={a ? `${a.importCode} · ${t(a.kind === 'RAW' ? 'raw' : 'finished')}` : undefined}
        right={a?.editable ? <HeaderButton icon="edit-2" label={t('edit')} onPress={() => router.push({ pathname: '/stock/adjustments/new', params: { id } })} /> : null}
      />
      <Page refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
        {q.error && <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
        {!a && !q.error && <SkeletonList rows={2} />}
        {a && (
          <>
            <View className="flex-row items-center gap-2">
              <StatusPill status={a.status} />
              <Muted>{dateTime(a.createdAt)}</Muted>
            </View>
            {!!a.rejectionReason && <Reason>{a.rejectionReason}</Reason>}
            <StatPair a={{ label: t('piecesChange'), value: a.piecesDelta ? signedInt(a.piecesDelta) : '—' }} b={{ label: t('cftChange'), value: signed3(a.cftDelta) }} />
            <WorkflowBar
              base={`/stock-adjustments/${id}`}
              code={a.code}
              status={a.status}
              canSubmit={a.canSubmit}
              canReview={a.canReview}
              confirmApprove={t('confirmApproveAdjustment', { code: a.code, change })}
              onDone={() => void q.refetch()}
            />
            <Card>
              <KV label={t('stockKind')} value={t(a.kind === 'RAW' ? 'raw' : 'finished')} />
              <KV label={t('sourceLoad')} value={a.importCode} />
              <KV label={t('woodType')} value={a.woodType} />
              {a.thicknessIn != null && a.widthIn != null && a.lengthFt != null && <KV label={t('size')} value={sizeLabel(a.thicknessIn, a.widthIn, a.lengthFt)} />}
              {!!a.piecesDelta && <KV label={a.kind === 'RAW' ? t('logsChange') : t('piecesChange')} value={signedInt(a.piecesDelta)} />}
              <KV label={t('reason')} value={a.reason} />
              <KV label={t('createdBy')} value={a.createdByName} />
            </Card>
          </>
        )}
      </Page>
    </View>
  );
}
