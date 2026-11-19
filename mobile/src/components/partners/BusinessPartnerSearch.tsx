import { useT } from '../../lib/i18n';
import { SearchBar } from '../ui';

export function BusinessPartnerSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useT();
  return <SearchBar value={value} onChange={onChange} placeholder={t('searchPartners')} />;
}
