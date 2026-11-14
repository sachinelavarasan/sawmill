import { useLocalSearchParams } from 'expo-router';
import { ExportForm } from '../../../../components/ExportForm';

export default function EditExportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ExportForm id={id} />;
}
