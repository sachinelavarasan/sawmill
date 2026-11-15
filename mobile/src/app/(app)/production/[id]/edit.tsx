import { useLocalSearchParams } from 'expo-router';
import { ProductionForm } from '../../../../components/ProductionForm';

export default function EditProductionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProductionForm id={id} />;
}
