/**
 * Themed dialogs, used instead of the native Alert (which never matches the dark theme):
 *   const confirm = useConfirm();   if (await confirm({ title, message })) …
 *   const prompt = usePrompt();     const reason = await prompt({ title, minLength: 3 });
 * One host at the app root renders whichever is open.
 */
import { createContext, ReactNode, useCallback, useContext, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useT } from '../lib/i18n';
import { Button, cn } from './ui';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  /** omit for a single OK button */
  cancelText?: string;
  destructive?: boolean;
}

export interface PromptOptions {
  title: string;
  message?: string;
  placeholder?: string;
  confirmText?: string;
  minLength?: number;
  destructive?: boolean;
}

type Open =
  | { kind: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'prompt'; opts: PromptOptions; resolve: (v: string | null) => void };

const Ctx = createContext<{ confirm: (o: ConfirmOptions) => Promise<boolean>; prompt: (o: PromptOptions) => Promise<string | null> } | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<Open | null>(null);
  const confirm = useCallback((opts: ConfirmOptions) => new Promise<boolean>((resolve) => setOpen({ kind: 'confirm', opts, resolve })), []);
  const prompt = useCallback((opts: PromptOptions) => new Promise<string | null>((resolve) => setOpen({ kind: 'prompt', opts, resolve })), []);
  const value = useRef({ confirm, prompt }).current;

  return (
    <Ctx.Provider value={value}>
      {children}
      {open && (
        <DialogView
          open={open}
          onClose={(v) => {
            setOpen(null);
            if (open.kind === 'confirm') open.resolve(v === true);
            else open.resolve(typeof v === 'string' ? v : null);
          }}
        />
      )}
    </Ctx.Provider>
  );
}

function DialogView({ open, onClose }: { open: Open; onClose: (v: boolean | string | null) => void }) {
  const t = useT();
  const [text, setText] = useState('');
  const isPrompt = open.kind === 'prompt';
  const o = open.opts;
  const min = isPrompt ? ((o as PromptOptions).minLength ?? 1) : 0;
  const cancelText = isPrompt ? t('cancel') : (o as ConfirmOptions).cancelText;
  const ok = !isPrompt || text.trim().length >= min;

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => onClose(isPrompt ? null : false)}>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <View className="flex-1 items-center justify-center bg-black/50 px-6">
          <View className="w-full max-w-[420px] gap-4 rounded-2xl bg-card p-5 shadow-lg" accessibilityViewIsModal>
            <Text className="text-lg font-bold text-foreground" accessibilityRole="header">
              {o.title}
            </Text>
            {!!o.message && <Text className="text-[15px] leading-[22px] text-muted-foreground">{o.message}</Text>}
            {isPrompt && (
              <TextInput
                autoFocus
                multiline
                value={text}
                onChangeText={setText}
                placeholder={(o as PromptOptions).placeholder}
                placeholderTextColorClassName="accent-muted-foreground"
                cursorColorClassName="accent-primary"
                accessibilityLabel={o.title}
                className="min-h-24 rounded-xl border-[1.5px] border-input bg-card px-3.5 py-3 text-base text-foreground focus:border-primary"
                style={{ textAlignVertical: 'top' }}
              />
            )}
            {isPrompt && min > 1 && <Text className="-mt-2 text-xs text-muted-foreground">{t('minChars', { n: min })}</Text>}
            <View className="flex-row gap-2.5">
              {!!cancelText && <Button className="flex-1" size="md" kind="secondary" title={cancelText} onPress={() => onClose(isPrompt ? null : false)} />}
              <Pressable
                onPress={() => ok && onClose(isPrompt ? text.trim() : true)}
                disabled={!ok}
                accessibilityRole="button"
                accessibilityState={{ disabled: !ok }}
                className={cn(
                  'min-h-11 flex-1 items-center justify-center rounded-xl px-4',
                  !ok ? 'bg-secondary' : o.destructive ? 'bg-destructive active:opacity-85' : 'bg-saffron active:opacity-85',
                )}
              >
                <Text className={cn('text-sm font-bold', !ok ? 'text-muted-foreground' : o.destructive ? 'text-card' : 'text-saffron-foreground')}>
                  {o.confirmText ?? (cancelText ? t('save') : 'OK')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function useConfirm() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useConfirm outside DialogProvider');
  return ctx.confirm;
}

export function usePrompt() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePrompt outside DialogProvider');
  return ctx.prompt;
}
