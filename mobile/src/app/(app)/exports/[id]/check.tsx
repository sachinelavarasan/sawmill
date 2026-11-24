/**
 * Lorry out → "Check before sending" (Sawmill Pro): everything going on this lorry, on one page,
 * before it goes to the owner.
 *
 *   walnut card   Pieces · Total CFT · From N lorries
 *   one card per source load: the lorry it came in on (plate), its code · wood, then each size
 *   with its CFT and pieces
 *   footer        Change (back to the record) · Send to owner (submits)
 *
 * With nothing on the lorry yet it says so, with "Add pieces" back to the record.
 */
import { sizeLabel } from '@timbertrail/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { ScreenHeader, StickyFooter, HeroPanel, Page } from '../../../../components/header';
import { Text } from '../../../../components/text';
import { toast } from '../../../../components/toast';
import { Button, Card, EmptyState, ErrorBox, Plate, SkeletonList } from '../../../../components/ui';
import { api } from '../../../../lib/api';
import { int, num3 } from '../../../../lib/format';
import { useSubmit } from '../../../../lib/hooks';
import { useT } from '../../../../lib/i18n';
import { invalidateOperations, useApi } from '../../../../lib/query';
import type { ExportDetail, ExportLine } from '../../../../lib/types';

export default function CheckExportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const router = useRouter();
  const q = useApi<ExportDetail>(`/exports/${id}`);
  const exp = q.data;

  // the lines, grouped by the load (and so the lorry) they came from, in the order first added
  const groups = useMemo(() => {
    const m = new Map<string, { code: string; lorry: string | null; lines: ExportLine[] }>();
    for (const l of exp?.lines ?? []) {
      const k = l.importLoadId ?? '';
      const g = m.get(k) ?? { code: l.importCode, lorry: l.importLorryNumber ?? null, lines: [] };
      g.lines.push(l);
      m.set(k, g);
    }
    return [...m.values()];
  }, [exp]);

  const [send, busy, error] = useSubmit(async () => {
    if (!exp) return;
    await api(`/exports/${exp.id}/submit`, { method: 'POST' });
    await invalidateOperations();
    toast(t('sentForApprovalToast'), 'success', exp.code);
    router.back();
  });

  const empty = !!exp && exp.lines.length === 0;
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader back title={t('checkBeforeSending')} subtitle={exp ? `${exp.code} · ${exp.lorryNumber}` : undefined} />
      <Page bottomInset={false}>
        {q.error && <ErrorBox message={(q.error as Error).message} onRetry={() => void q.refetch()} />}
        {!exp && !q.error && <SkeletonList rows={3} />}
        {exp && (
          <>
            <HeroPanel className="flex-row gap-7">
              <Figure label={t('pieces')} value={int(exp.totalPieces)} />
              <Figure label={t('totalCft')} value={num3(exp.totalCft)} />
              {groups.length > 0 && <Figure label={t('fromLorries')} value={int(groups.length)} unit={t(groups.length === 1 ? 'lorryWord' : 'lorriesWord')} />}
            </HeroPanel>

            {empty ? (
              <EmptyState mod="out" icon="truck-out" title={t('nothingOnLorry')} body={t('nothingOnLorrySub')} action={{ label: t('addPieces'), onPress: () => router.back() }} />
            ) : (
              <>
                <Text className="pt-2 text-base font-semibold text-muted-foreground">{t('whatOnLorry')}</Text>
                {groups.map((g) => (
                  <Card key={g.code || 'none'} className="gap-0 p-0">
                    <View className="flex-row items-center gap-3 border-b border-border px-4 py-3.5">
                      {g.lorry ? <Plate number={g.lorry} /> : null}
                      <Text className="shrink text-[14px] text-muted-foreground" numberOfLines={1}>
                        {[g.code, exp.woodType].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    {g.lines.map((l, i) => (
                      <View key={l.id} className={`flex-row items-center justify-between gap-3 px-4 py-3 ${i < g.lines.length - 1 ? 'border-b border-border' : ''}`}>
                        <View className="gap-0.5">
                          <Text className="text-[18px] font-bold tabular-nums text-foreground font-display">{sizeLabel(l.thicknessIn, l.widthIn, l.lengthFt)}</Text>
                          <Text className="text-[13px] tabular-nums text-muted-foreground">{num3(l.cft)} CFT</Text>
                        </View>
                        <Text className="text-[24px] font-bold tabular-nums text-foreground font-display">
                          {int(l.pieces)}
                          <Text className="text-[13px] font-semibold text-muted-foreground"> {t('pieces').toLowerCase()}</Text>
                        </Text>
                      </View>
                    ))}
                  </Card>
                ))}
              </>
            )}
            {error && <ErrorBox message={error} />}
          </>
        )}
      </Page>
      <StickyFooter>
        <View className="flex-row gap-3">
          <Button className="flex-1" kind="secondary" title={t('changeAction')} disabled={busy} onPress={() => router.back()} />
          <Button className="flex-[1.6]" icon="arrow-right" title={t('submitForApproval')} busy={busy} disabled={!exp || empty || !exp.canSubmit} onPress={() => void send()} />
        </View>
      </StickyFooter>
    </View>
  );
}

function Figure({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View className="shrink gap-0.5">
      <Text className="text-[13px] font-medium text-hero-muted" numberOfLines={1}>
        {label}
      </Text>
      <Text className="text-[30px] font-bold leading-9 tabular-nums text-hero-foreground font-display" numberOfLines={1} adjustsFontSizeToFit>
        {value}
        {unit ? <Text className="text-[14px] font-semibold text-hero-muted"> {unit}</Text> : null}
      </Text>
    </View>
  );
}
