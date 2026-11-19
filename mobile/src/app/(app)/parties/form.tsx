/** [OWNER-ONLY] Add or edit a client / supplier (?kind=clients|suppliers&id=). */
import { useLocalSearchParams } from 'expo-router';
import { BusinessPartnerForm } from '../../../components/partners/BusinessPartnerForm';

export default function PartyFormScreen() {
  const { kind, id } = useLocalSearchParams<{ kind: 'clients' | 'suppliers'; id?: string }>();
  return <BusinessPartnerForm kind={kind === 'clients' ? 'clients' : 'suppliers'} id={id} />;
}
