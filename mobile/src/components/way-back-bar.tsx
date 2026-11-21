/**
 * "Loading in logs for sawing … — Back to sawing": shown on a Load In (record and measuring) that
 * was started from New Sawing ("Not in stock? Load in new logs"). The button returns to the New
 * Sawing already open — router.dismissTo, not a new copy — with this load chosen (`load=<id>`).
 * Its own `back` (e.g. to a load out) rides along, so a whole chain still finds its way home.
 */
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useT } from '../lib/i18n';
import { sawingLink, splitLink } from '../lib/ways-back';
import { Text } from './text';
import { Button } from './ui';

export function BackToSawingBar({ back, loadId }: { back: string; loadId: string }) {
  const t = useT();
  const router = useRouter();
  const link = sawingLink(back);
  if (!link) return null;
  const go = () => {
    const { pathname, params } = splitLink(link);
    router.dismissTo({ pathname: pathname as '/production/new', params: { ...params, load: loadId } });
  };
  return (
    <View className="gap-2.5 rounded-2xl bg-primary-soft p-3.5">
      <Text className="text-[14px] font-medium text-foreground">{t('loadInForSawing')}</Text>
      <Button icon="arrow-left" title={t('backToSawing')} onPress={go} />
    </View>
  );
}
