/**
 * Confirmations and prompts as compact bottom sheets (AppBottomSheet), used instead of the
 * native Alert (which never matches the theme):
 *   const confirm = useConfirm();   if (await confirm({ title, message })) …
 *   const prompt = usePrompt();     const reason = await prompt({ title, minLength: 3 });
 * One host at the app root (inside the sheet provider) renders whichever is open.
 *
 * The sheet is compact and focused: title, message (and the text box for a prompt), then Cancel
 * beside the confirming action — near-black, or solid red when `destructive`. Swiping it away,
 * tapping outside or pressing back counts as Cancel; a prompt with text typed in can only be
 * closed with its buttons or back, so a stray swipe doesn't lose a rejection reason.
 */
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useT } from '../lib/i18n';
import { AppBottomSheet, type SheetHandle, SheetActions, SheetInput } from './bottom-sheet';
import { fontStyleFor, Text } from './text';

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
  | { id: number; kind: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { id: number; kind: 'prompt'; opts: PromptOptions; resolve: (v: string | null) => void };

const Ctx = createContext<{ confirm: (o: ConfirmOptions) => Promise<boolean>; prompt: (o: PromptOptions) => Promise<string | null> } | null>(null);

/** What closing without choosing means: "no" for a confirm, nothing for a prompt. */
const cancelOf = (o: Open) => (o.kind === 'confirm' ? false : null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<Open | null>(null);
  const sheet = useRef<SheetHandle>(null);
  /** the dialog on screen, and whether it has been answered (each is answered exactly once) */
  const current = useRef<{ dialog: Open; settled: boolean } | null>(null);
  const nextId = useRef(1);

  const show = useCallback((dialog: Open) => {
    // a new dialog while one is still up: the old one counts as cancelled
    const prev = current.current;
    if (prev && !prev.settled) {
      prev.settled = true;
      (prev.dialog.resolve as (v: unknown) => void)(cancelOf(prev.dialog));
    }
    current.current = { dialog, settled: false };
    setOpen(dialog);
  }, []);

  const confirm = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => show({ id: nextId.current++, kind: 'confirm', opts, resolve })),
    [show],
  );
  const prompt = useCallback(
    (opts: PromptOptions) => new Promise<string | null>((resolve) => show({ id: nextId.current++, kind: 'prompt', opts, resolve })),
    [show],
  );
  const value = useRef({ confirm, prompt }).current;

  // present once the dialog's content is rendered
  useEffect(() => {
    if (open) sheet.current?.open();
  }, [open]);

  /** answer the dialog (once) and close the sheet */
  const answer = useCallback((v: boolean | string | null) => {
    const c = current.current;
    if (!c || c.settled) return;
    c.settled = true;
    (c.dialog.resolve as (v: unknown) => void)(v);
    sheet.current?.close();
  }, []);

  return (
    <Ctx.Provider value={value}>
      {children}
      <DialogSheet
        sheetRef={sheet}
        open={open}
        onAnswer={answer}
        onDismissed={() => {
          // swiped away, tapped outside or back: Cancel (no-op if a button already answered)
          const c = current.current;
          if (c) answer(cancelOf(c.dialog));
          current.current = null;
          setOpen(null);
        }}
      />
    </Ctx.Provider>
  );
}

function DialogSheet({
  sheetRef,
  open,
  onAnswer,
  onDismissed,
}: {
  sheetRef: React.RefObject<SheetHandle | null>;
  open: Open | null;
  onAnswer: (v: boolean | string | null) => void;
  onDismissed: () => void;
}) {
  const t = useT();
  const [text, setText] = useState('');
  // a fresh text box for every prompt
  useEffect(() => setText(''), [open?.id]);

  const isPrompt = open?.kind === 'prompt';
  const o = open?.opts;
  const min = isPrompt ? ((o as PromptOptions).minLength ?? 1) : 0;
  const cancelText = isPrompt ? t('cancel') : (o as ConfirmOptions | undefined)?.cancelText;
  const ok = !isPrompt || text.trim().length >= min;
  const confirmText = o?.confirmText ?? (cancelText ? t('save') : 'OK');

  return (
    <AppBottomSheet
      ref={sheetRef}
      variant="compact"
      title={o?.title}
      protect={isPrompt && text.trim().length > 0}
      onDismiss={onDismissed}
      footer={
        o && (
          <SheetActions
            primary={{ title: confirmText, destructive: o.destructive, disabled: !ok, onPress: () => onAnswer(isPrompt ? text.trim() : true) }}
            secondary={cancelText ? { title: cancelText, onPress: () => onAnswer(isPrompt ? null : false) } : undefined}
          />
        )
      }
    >
      {o && (
        <View className="gap-3 pb-1">
          {!!o.message && <Text className="text-[15px] leading-[22px] text-muted-foreground">{o.message}</Text>}
          {isPrompt && (
            <SheetInput
              key={open?.id}
              autoFocus
              multiline
              value={text}
              onChangeText={setText}
              placeholder={(o as PromptOptions).placeholder}
              placeholderTextColorClassName="accent-muted-foreground"
              cursorColorClassName="accent-saffron"
              accessibilityLabel={o.title}
              className="min-h-24 rounded-xl border border-input bg-card px-3.5 py-3 text-base text-foreground"
              style={[fontStyleFor(), { textAlignVertical: 'top' }]}
            />
          )}
          {isPrompt && min > 1 && <Text className="text-xs text-muted-foreground">{t('minChars', { n: min })}</Text>}
        </View>
      )}
    </AppBottomSheet>
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
