/** The TimberTrail mark: the timber icon and the two-tone wordmark. */
import { Image, View } from 'react-native';
import { WORDMARK } from '../lib/brand';
import { Text } from './text';
import { cn } from './ui';

export function BrandMark({ size = 'md', onDark = true, tagline }: { size?: 'sm' | 'md' | 'lg'; onDark?: boolean; tagline?: string }) {
  const icon = { sm: 'h-9 w-9 rounded-lg', md: 'h-16 w-16 rounded-2xl', lg: 'h-20 w-20 rounded-3xl' }[size];
  const word = { sm: 'text-[17px]', md: 'text-[28px]', lg: 'text-[34px]' }[size];
  const row = size === 'sm';
  return (
    <View className={cn(row ? 'flex-row items-center gap-2.5' : 'items-center gap-3')} accessible accessibilityRole="header" accessibilityLabel={`${WORDMARK.main}${WORDMARK.accent}`}>
      <Image source={require('../../assets/icon-dark.png')} className={icon} resizeMode="contain" accessible={false} />
      <View className={cn(!row && 'items-center gap-1')}>
        <Text className={cn('font-extrabold tracking-tight', word)}>
          <Text className={onDark ? 'text-hero-foreground' : 'text-foreground'}>{WORDMARK.main}</Text>
          <Text className="text-saffron">{WORDMARK.accent}</Text>
        </Text>
        {!!tagline && <Text className={cn('text-[13px] tracking-wide', onDark ? 'text-hero-muted' : 'text-muted-foreground')}>{tagline}</Text>}
      </View>
    </View>
  );
}
