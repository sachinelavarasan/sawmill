import { useLocalSearchParams } from 'expo-router';
import { ImportForm } from '../../../../components/ImportForm';

export default function EditImportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ImportForm id={id} />;
}
