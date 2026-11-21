import { ScrollView } from 'react-native';
import { useT } from '../../lib/i18n';
import { Chip } from '../ui';
import type { PartnerFilter } from './types';

export function BusinessPartnerFilters({
  value,
  onChange,
  totalCount,
  outstandingCount,
  settledCount,
  financialsAvailable,
}: {
  value: PartnerFilter;
  onChange: (v: PartnerFilter) => void;
  totalCount: number | undefined;
  outstandingCount: number | undefined;
  settledCount: number | undefined;
  financialsAvailable: boolean;
}) {
  const t = useT();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="flex-row gap-2">
      <Chip text={t('all')} on={value === 'all'} count={totalCount} onPress={() => onChange('all')} />
      {financialsAvailable && (
        <>
          <Chip alert text={t('outstanding')} on={value === 'outstanding'} count={outstandingCount} onPress={() => onChange('outstanding')} />
          <Chip text={t('settled')} on={value === 'settled'} count={settledCount} onPress={() => onChange('settled')} />
        </>
      )}
    </ScrollView>
  );
}
