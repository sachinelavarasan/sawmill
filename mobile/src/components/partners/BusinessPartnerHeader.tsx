import { HeaderButton, ScreenHeader } from '../header';
import { useT } from '../../lib/i18n';
import { PARTNER_META, type PartnerKind } from './types';

export function BusinessPartnerHeader({
  kind,
  onAdd,
  onBack,
}: {
  kind: PartnerKind;
  onAdd: () => void;
  onBack?: () => void;
}) {
  const t = useT();
  const meta = PARTNER_META[kind];

  return (
    <ScreenHeader
      compact
      back
      onBack={onBack}
      title={t(meta.title)}
      subtitle={t(meta.subtitle)}
      right={<HeaderButton icon="plus" label={t(meta.addLabel)} onPress={onAdd} />}
    />
  );
}
