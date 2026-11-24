/**
 * Lorry number: a searchable sheet of every lorry the mill has seen (loads in and out, newest
 * first, the last driver beside each), with "Add …" for a new number (web: components/lorry-picker.tsx).
 * Picking a known lorry hands back the driver and owner it last came with, so the form can fill them in.
 */
import { useT } from '../lib/i18n';
import { useApi } from '../lib/query';
import { SelectField } from './sheet';

export interface Lorry {
  lorryNumber: string;
  driverName: string | null;
  driverMobile: string | null;
  lorryOwnerName: string | null;
  lorryOwnerMobile: string | null;
  trips: number;
  lastAt?: string;
}

/** "tn45ab1234" / "TN 45  ab 1234" → upper-cased, single spaces */
export const cleanLorry = (s: string) => s.trim().replace(/\s+/g, ' ').toUpperCase();

export function LorryPicker({
  value,
  onChange,
  required,
  error,
  hint,
}: {
  value: string;
  /** the lorry number, and the known lorry's details when one was picked (null for a new one) */
  onChange: (lorryNumber: string, known: Lorry | null) => void;
  required?: boolean;
  error?: string;
  hint?: string;
}) {
  const t = useT();
  const lorries = useApi<{ items: Lorry[] }>('/imports/lorries').data?.items ?? [];
  const options = lorries.map((l) => ({ value: l.lorryNumber, label: l.lorryNumber, hint: l.driverName || undefined }));
  // a number typed before (or loaded with a record) that isn't in the list yet stays pickable
  if (value && !options.some((o) => o.value === value)) options.unshift({ value, label: value, hint: undefined });

  return (
    <SelectField
      plate
      label={t('lorryNumber')}
      required={required}
      value={value}
      options={options}
      searchable
      placeholder={t('pickOrAddLorry')}
      error={error}
      hint={hint}
      onChange={(v) => onChange(v, lorries.find((l) => l.lorryNumber === v) ?? null)}
      onCreate={async (typed) => {
        const n = cleanLorry(typed);
        if (n.length < 4 || n.length > 20) throw new Error(t('lorryNumberHint'));
        // a known lorry typed in another way ("tn45 ab1234") is the same lorry; SelectField then calls onChange with it
        const known = lorries.find((l) => l.lorryNumber.replace(/\s/g, '') === n.replace(/\s/g, ''));
        return known?.lorryNumber ?? n;
      }}
    />
  );
}

/** A known lorry's driver and owner, written only into the fields that are still empty. */
export function fillFromLorry<F extends { driverName: string; driverMobile: string; lorryOwnerName: string; lorryOwnerMobile: string }>(form: F, known: Lorry | null): F {
  if (!known) return form;
  return {
    ...form,
    driverName: form.driverName || known.driverName || '',
    driverMobile: form.driverMobile || known.driverMobile || '',
    lorryOwnerName: form.lorryOwnerName || known.lorryOwnerName || '',
    lorryOwnerMobile: form.lorryOwnerMobile || known.lorryOwnerMobile || '',
  };
}
