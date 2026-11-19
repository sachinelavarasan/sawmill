import { dateOnly } from '../../lib/format';
import { useT } from '../../lib/i18n';
import { HeaderButton, ScreenHeader } from '../header';

/** Consistent header for report detail screens: title, mill + period subtitle, Excel share action. */
export function ReportDetailHeader({
  title,
  millName,
  period,
  sharing,
  onShare,
}: {
  title: string;
  millName?: string;
  period?: { from: string; to: string } | null;
  sharing?: boolean;
  onShare?: () => void;
}) {
  const t = useT();
  const subtitle = millName
    ? `${millName}${period ? ` · ${dateOnly(period.from)} – ${dateOnly(period.to)}` : ''}`
    : undefined;

  return (
    <ScreenHeader
      compact
      back
      title={title}
      subtitle={subtitle}
      right={
        onShare ? (
          <HeaderButton
            icon={sharing ? 'loader' : 'share-2'}
            label={t('shareExcel')}
            onPress={onShare}
          />
        ) : undefined
      }
    />
  );
}
