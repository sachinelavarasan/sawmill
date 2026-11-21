/**
 * Lorry number: a dropdown of every lorry the mill has seen (loads in and out), searchable,
 * with "Add …" for a new one. Picking a known lorry hands back the driver and owner it last
 * came with, so the form can fill them in.
 */
import { useApi } from './common';
import { SearchAddPicker } from './party-picker';
import { useI18n } from '../i18n';

export interface Lorry {
  lorryNumber: string;
  driverName: string | null;
  driverMobile: string | null;
  lorryOwnerName: string | null;
  lorryOwnerMobile: string | null;
  trips: number;
}

/** "tn45ab1234" / "TN 45 AB 1234" → "TN 45 AB 1234" as typed, upper-cased, single spaces */
const clean = (s: string) => s.trim().replace(/\s+/g, ' ').toUpperCase();

export function LorryPicker({
  id,
  value,
  onChange,
  required,
}: {
  id?: string;
  value: string;
  /** the lorry number, and the known lorry's details when one was picked (null for a new one) */
  onChange: (lorryNumber: string, known: Lorry | null) => void;
  required?: boolean;
}) {
  const { t } = useI18n();
  const { data } = useApi<{ items: Lorry[] }>('/imports/lorries');
  const lorries = data?.items ?? [];
  const options = lorries.map((l) => ({ value: l.lorryNumber, label: l.lorryNumber, hint: l.driverName || null }));
  // a number typed before (or loaded with a record) that isn't in the list yet stays pickable
  if (value && !options.some((o) => o.value === value)) options.unshift({ value, label: value, hint: null });

  return (
    <>
      <SearchAddPicker
        id={id}
        options={options}
        value={value}
        onChange={(v) => onChange(v, lorries.find((l) => l.lorryNumber === v) ?? null)}
        onCreate={async (name) => {
          const n = clean(name);
          if (n.length < 4 || n.length > 20) throw new Error(t('lorryNumberHint'));
          return { value: n, label: n, hint: null };
        }}
        placeholder={t('pickOrAddLorry')}
        maxLength={20}
      />
      {/* keeps the browser's "please fill in" check */}
      {required && <input tabIndex={-1} aria-hidden required value={value} onChange={() => undefined} className="sr-only" />}
    </>
  );
}
