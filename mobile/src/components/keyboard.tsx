/**
 * Keeps inputs and pinned buttons above the keyboard — the same setup as the Expensify app:
 * iOS pads the content; Android shrinks the view to the space left ("height"). Android's own
 * window resize (softwareKeyboardLayoutMode "resize") is left as is, so nothing is lifted twice.
 * Put a ScrollView with keyboardShouldPersistTaps="handled" inside.
 */
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { cn } from './ui';

export function KeyboardView({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <KeyboardAvoidingView {...(Platform.OS === 'ios' ? { behavior: 'padding' as const } : { behavior: 'height' as const })} className={cn('flex-1', className)}>
      {children}
    </KeyboardAvoidingView>
  );
}
