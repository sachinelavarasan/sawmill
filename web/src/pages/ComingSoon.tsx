import { useI18n, type TKey } from '../i18n';

export function ComingSoon({ titleKey, phase }: { titleKey: TKey; phase: number }) {
  const { t } = useI18n();
  return (
    <div className="page">
      <div className="page-head">
        <h1>{t(titleKey)}</h1>
      </div>
      <div className="card empty">{t('comingSoon', { n: phase })}</div>
    </div>
  );
}
