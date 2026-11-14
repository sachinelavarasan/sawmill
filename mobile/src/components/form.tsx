/** Form building blocks: labelled inputs, numeric inputs with units, grouped sections, and the form screen shell. */
import { Children, ReactNode, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, type TextInputProps, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cleanDecimal, cleanInt } from '../lib/format';
import { useT } from '../lib/i18n';
import { ScreenHeader } from './header';
import { SheetInput } from './sheet';
import { useInSheet } from './sheet-context';
import { cn, ErrorBox, Icon, Muted } from './ui';

type FieldProps = {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  /** shown inside the box on the right, e.g. "in", "ft", "₹" */
  unit?: string;
  children?: ReactNode;
} & Omit<TextInputProps, 'className'>;

export function Field({ label, required, hint, error, unit, children, multiline, ...input }: FieldProps) {
  const Input = useInSheet() ? SheetInput : TextInput;
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-semibold text-foreground">
        {label}
        {required && <Text className="text-destructive"> *</Text>}
      </Text>
      <View
        className={cn(
          'flex-row items-center rounded-xl border-[1.5px] bg-card',
          error ? 'border-destructive' : 'border-input',
          input.editable === false && 'bg-secondary',
        )}
      >
        <Input
          accessibilityLabel={label}
          accessibilityHint={hint}
          placeholderTextColorClassName="accent-muted-foreground"
          cursorColorClassName="accent-primary"
          selectionColorClassName="accent-saffron"
          multiline={multiline}
          {...input}
          className={cn('flex-1 px-4 text-base text-foreground', multiline ? 'min-h-24 py-3' : 'min-h-[50px]')}
          style={multiline ? { textAlignVertical: 'top' } : undefined}
        />
        {!!unit && <Text className="pr-4 text-[15px] font-semibold text-muted-foreground">{unit}</Text>}
      </View>
      {error ? <Text className="text-[13px] text-destructive">{error}</Text> : hint ? <Muted>{hint}</Muted> : null}
      {children}
    </View>
  );
}

/** Numeric input: the number keypad, only digits and one dot, limited decimal places. */
export function NumberField({ value, onChangeText, decimals = 2, ...rest }: FieldProps & { value: string; onChangeText: (v: string) => void; decimals?: number }) {
  return (
    <Field
      {...rest}
      value={value}
      onChangeText={(v) => onChangeText(decimals === 0 ? cleanInt(v) : cleanDecimal(v, decimals))}
      keyboardType={decimals === 0 ? 'number-pad' : 'decimal-pad'}
      inputMode={decimals === 0 ? 'numeric' : 'decimal'}
    />
  );
}

/** Two fields side by side. */
export function Row({ children }: { children: ReactNode }) {
  return (
    <View className="flex-row gap-3">
      {Children.toArray(children).map((c, i) => (
        <View key={i} className="flex-1">
          {c}
        </View>
      ))}
    </View>
  );
}

/** A titled group of fields in a white card; `collapsible` ones start closed. */
export function FormSection({
  title,
  subtitle,
  children,
  collapsible,
  initiallyOpen = !collapsible,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  collapsible?: boolean;
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const head = (
    <View className="flex-row items-center gap-2">
      <View className="flex-1 gap-0.5">
        <Text className="text-base font-bold text-foreground">{title}</Text>
        {!!subtitle && <Muted>{subtitle}</Muted>}
      </View>
      {collapsible && <Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} colorClassName="accent-muted-foreground" />}
    </View>
  );
  return (
    <View className="gap-4 rounded-xl border border-border bg-card p-4">
      {collapsible ? (
        <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} className="-m-1 p-1">
          {head}
        </Pressable>
      ) : (
        head
      )}
      {open && <View className="gap-4">{children}</View>}
    </View>
  );
}

/**
 * A full-screen form: header with back, fields that scroll above the keyboard,
 * and the primary action pinned to the bottom so it is never hidden.
 */
export function FormScreen({
  title,
  subtitle,
  children,
  footer,
  error,
  onBack,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  error?: string | null;
  onBack?: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={title} subtitle={subtitle} back onBack={onBack} />
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <ScrollView className="flex-1" contentContainerClassName="gap-3 p-4 pb-6" keyboardShouldPersistTaps="handled">
          {children}
          {error && <ErrorBox message={error} />}
        </ScrollView>
        {footer && (
          <View className="gap-2 border-t border-border bg-card px-4 pt-3" style={{ paddingBottom: 12 + insets.bottom }}>
            {footer}
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

/** "* required" note under a form's first section. */
export function RequiredNote() {
  const t = useT();
  return <Muted>{t('requiredNote')}</Muted>;
}
