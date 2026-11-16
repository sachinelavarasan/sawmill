/**
 * Adding a supplier or client by name straight from a picker (SelectField's onCreate),
 * so a forgotten one doesn't mean leaving the form. Phone, address and GST can be
 * filled in later from More → Suppliers / Clients.
 */
import { useCallback } from 'react';
import { toast } from '../components/toast';
import { api } from './api';
import { useT } from './i18n';
import { invalidate } from './query';
import type { Party } from './types';

export function useCreateParty(kind: 'suppliers' | 'clients') {
  const t = useT();
  return useCallback(
    async (name: string) => {
      const row = await api<Party>(`/${kind}`, { method: 'POST', body: { name } });
      toast(t('partyAdded', { name: row.name }));
      // the picker shows the new name itself until this refreshed list arrives
      void invalidate(`/${kind}`, '/accounts');
      return row.id;
    },
    [kind, t],
  );
}
