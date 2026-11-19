/**
 * AppBottomSheet — the one bottom sheet for the whole app (@gorhom/bottom-sheet underneath).
 * Every sheet — pickers, forms, menus, confirmations — is one of these, so they all look and
 * behave the same. Screens never style a sheet themselves.
 *
 *   const sheet = useSheet();
 *   <Button onPress={sheet.open} />
 *   <AppBottomSheet ref={sheet.ref} variant="medium" title="…" footer={<SheetActions primary={…} />}>…</AppBottomSheet>
 *
 * Look (theme tokens only)
 *   surface   light: --color-card (white) · dark: --color-background (raised charcoal, lighter than what
 *             it covers) with a hairline (--color-input) along the top — never the backdrop's colour
 *   corners   28dp at the top · handle 40 × 5dp (--color-muted-foreground)
 *   backdrop  60% black over the whole app, bottom bar and status bar included
 *   body      20dp side padding (`padded`), title in the display face, sticky header and footer
 *
 * Height (`variant`) — sized to the content, capped by purpose; anything taller scrolls
 *   compact   up to half the screen: confirmations, logout, delete, short menus
 *   medium    up to ~¾: account, preferences, filters, short lists and forms
 *   expanded  up to the full height under the status bar: long lists, searchable dropdowns
 *             (`content="list"`: a fixed 90% so the list doesn't jump while you search), detailed forms
 *   full      the whole height under the status bar — only for immersive workflows
 *
 * Behaviour
 *   swipe down · tap the backdrop · Android back (the sheet opened last closes first) · close button
 *   `protect`: no swipe / backdrop close (back and the close button still work) — for forms with
 *   typed values, so a stray swipe can't throw them away
 *   opens and closes with a spring that never overshoots; keyboard-aware (the sheet rides up,
 *   restores when the keyboard goes); the footer stays above the keyboard and the nav bar
 *   pickers opened from a sheet stack on top of it ("push"), and the sheet waits underneath
 */
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetFooter,
  type BottomSheetFooterProps,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  useBottomSheetSpringConfigs,
} from '@gorhom/bottom-sheet';
import { forwardRef, type ReactNode, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { BackHandler, type NativeEventSubscription, Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable, withUniwind } from 'uniwind';
import { useT } from '../lib/i18n';
import { useThemeToggle } from '../lib/theme';
import { InSheet } from './sheet-context';
import { Text } from './text';
import { Button, cn, Icon, type IconName, Muted } from './ui';

export const SheetInput = withUniwind(BottomSheetTextInput);

export interface SheetHandle {
  open: () => void;
  close: () => void;
}

export function useSheet() {
  const ref = useRef<SheetHandle>(null);
  return { ref, open: () => ref.current?.open(), close: () => ref.current?.close() };
}

export type SheetVariant = 'compact' | 'medium' | 'expanded' | 'full';

/** Share of the height under the status bar a variant may take before its content scrolls. */
const MAX_SHARE: Record<SheetVariant, number> = { compact: 0.5, medium: 0.78, expanded: 1, full: 1 };
/** Opens quickly and settles without bouncing (a spring that never overshoots). */
const SPRING = { damping: 32, stiffness: 320, mass: 0.9, overshootClamping: true } as const;
const BACKDROP_OPACITY = 0.6;
/** the standard side padding of everything in a sheet */
export const SHEET_GUTTER = 'px-5';

/** The sheet's surface and edge colours — for anything that must paint over scrolling content (a sticky header). */
export function useSheetColors() {
  const { dark } = useThemeToggle();
  const [card, raised, edge, handle] = useCSSVariable(['--color-card', '--color-background', '--color-input', '--color-muted-foreground']).map(String);
  return { surface: dark ? raised : card, edge: dark ? edge : 'transparent', handle };
}

/**
 * Android back closes the sheet while it is open. Subscribed on open, so the sheet opened last (on
 * top of a stack) is the one that closes first.
 */
function useBackToClose(modal: React.RefObject<BottomSheetModal | null>, onDismiss?: () => void) {
  const back = useRef<NativeEventSubscription | null>(null);
  const release = () => {
    back.current?.remove();
    back.current = null;
  };
  useEffect(() => () => back.current?.remove(), []);
  return {
    onChange: (index: number) => {
      if (index >= 0 && !back.current) {
        back.current = BackHandler.addEventListener('hardwareBackPress', () => {
          modal.current?.dismiss();
          return true;
        });
      } else if (index < 0) release();
    },
    onDismiss: () => {
      release();
      onDismiss?.();
    },
  };
}

// ───────── header ─────────

/** Title (display face), optional subtitle, optional round close button. Sticks to the top while the body scrolls. */
export function SheetHeader({ title, subtitle, onClose }: { title?: string; subtitle?: string; onClose?: () => void }) {
  const t = useT();
  const { dark } = useThemeToggle();
  const colors = useSheetColors();
  if (!title && !subtitle && !onClose) return null;
  return (
    <View style={{ backgroundColor: colors.surface }} className={cn('flex-row items-start gap-3 pb-3 pt-1', SHEET_GUTTER)}>
      <View className="flex-1 gap-0.5 pt-1">
        {!!title && (
          <Text className="text-lg font-bold tracking-tight text-foreground font-display" accessibilityRole="header">
            {title}
          </Text>
        )}
        {!!subtitle && <Muted>{subtitle}</Muted>}
      </View>
      {onClose && (
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('close')}
          hitSlop={6}
          className={cn('h-10 w-10 items-center justify-center rounded-full active:opacity-70', dark ? 'bg-primary-soft' : 'bg-secondary')}
        >
          <Icon name="x" size={18} colorClassName="accent-foreground" />
        </Pressable>
      )}
    </View>
  );
}

// ───────── actions ─────────

export interface SheetAction {
  title: string;
  onPress: () => void;
  icon?: IconName;
  busy?: boolean;
  disabled?: boolean;
  /** red: solid as the primary action, outlined as a secondary one */
  destructive?: boolean;
}

/**
 * The action area for a sheet's `footer`: the primary action (near-black, or solid red when
 * destructive) beside up to two secondary ones (outlined). With three, the secondary pair sits
 * above a full-width primary.
 */
export function SheetActions({ primary, secondary }: { primary?: SheetAction; secondary?: SheetAction | SheetAction[] }) {
  const others = secondary ? (Array.isArray(secondary) ? secondary : [secondary]) : [];
  const button = (a: SheetAction, main: boolean, className?: string) => (
    <Button
      key={a.title}
      className={className}
      kind={main ? (a.destructive ? 'destructive' : 'primary') : a.destructive ? 'danger' : 'secondary'}
      icon={a.icon}
      title={a.title}
      busy={a.busy}
      disabled={a.disabled}
      onPress={a.onPress}
    />
  );
  if (others.length >= 2)
    return (
      <View className="gap-2.5">
        <View className="flex-row gap-2.5">{others.map((a) => button(a, false, 'flex-1'))}</View>
        {primary && button(primary, true)}
      </View>
    );
  return (
    <View className="flex-row gap-2.5">
      {others.map((a) => button(a, false, 'flex-1'))}
      {primary && button(primary, true, others.length ? 'flex-[1.4]' : 'flex-1')}
    </View>
  );
}

// ───────── the sheet ─────────

type ListParts = { header: ReactNode; bottomPadding: number };

export interface AppBottomSheetProps {
  variant?: SheetVariant;
  title?: string;
  subtitle?: string;
  /** round × in the header (default: on for medium and taller sheets that have a title, and whenever `protect` is on) */
  showClose?: boolean;
  /** sticky action area — usually <SheetActions /> */
  footer?: ReactNode;
  /**
   * scroll (default): the body scrolls when taller than the sheet (fixed blocks such as a calendar too)
   * list: the body is a virtualised list the caller renders — `children` is a function given the
   *       header (render it as the list's header) and the bottom padding (for its content)
   */
  content?: 'scroll' | 'list';
  /** wrap the body in the standard side padding (default true; off for edge-to-edge lists and calendars) */
  padded?: boolean;
  /** guard typed values: no swipe or backdrop close; back and the close button still close */
  protect?: boolean;
  onDismiss?: () => void;
  children: ReactNode | ((parts: ListParts) => ReactNode);
}

export const AppBottomSheet = forwardRef<SheetHandle, AppBottomSheetProps>(function AppBottomSheet(
  { variant = 'medium', title, subtitle, showClose, footer, content = 'scroll', padded = true, protect = false, onDismiss, children },
  ref,
) {
  const modal = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const colors = useSheetColors();
  const animationConfigs = useBottomSheetSpringConfigs(SPRING);
  const closing = useBackToClose(modal, onDismiss);
  const [footerHeight, setFooterHeight] = useState(0);
  useImperativeHandle(ref, () => ({ open: () => modal.current?.present(), close: () => modal.current?.dismiss() }), []);

  const close = useCallback(() => modal.current?.dismiss(), []);
  const closeButton = showClose ?? (protect || (variant !== 'compact' && !!title));
  const header = <SheetHeader title={title} subtitle={subtitle} onClose={closeButton ? close : undefined} />;
  const hasHeader = !!(title || subtitle || closeButton);
  const bottomPadding = footer ? footerHeight + 8 : insets.bottom + 20;

  // height by purpose: a fixed snap for full screens and lists, otherwise sized to the content up to the variant's cap
  const fixed = variant === 'full' ? '100%' : variant === 'expanded' && content === 'list' ? '90%' : null;
  const available = height - insets.top;

  const backdrop = useCallback(
    (p: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...p} pressBehavior={protect ? 'none' : 'close'} appearsOnIndex={0} disappearsOnIndex={-1} opacity={BACKDROP_OPACITY} />
    ),
    [protect],
  );
  const renderFooter = useCallback(
    (p: BottomSheetFooterProps) => (
      <BottomSheetFooter {...p}>
        <InSheet.Provider value>
          <View
            onLayout={(e) => setFooterHeight(Math.round(e.nativeEvent.layout.height))}
            style={{ backgroundColor: colors.surface, paddingBottom: insets.bottom + 12 }}
            className={cn('gap-2.5 border-t border-border pt-3', SHEET_GUTTER)}
          >
            {footer}
          </View>
        </InSheet.Provider>
      </BottomSheetFooter>
    ),
    [footer, colors.surface, insets.bottom],
  );

  const body = typeof children === 'function' ? null : padded ? <View className={SHEET_GUTTER}>{children}</View> : children;

  return (
    <BottomSheetModal
      ref={modal}
      // a picker opened from inside this sheet (supplier, client, date…) stacks on top and this one
      // waits underneath; the default "switch" closed a form when its picker opened
      stackBehavior="push"
      enableDynamicSizing={!fixed}
      snapPoints={fixed ? [fixed] : undefined}
      maxDynamicContentSize={fixed ? undefined : Math.round(available * MAX_SHARE[variant])}
      topInset={insets.top}
      enablePanDownToClose={!protect}
      animationConfigs={animationConfigs}
      backdropComponent={backdrop}
      footerComponent={footer ? renderFooter : undefined}
      onChange={closing.onChange}
      onDismiss={closing.onDismiss}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backgroundStyle={{ backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: colors.edge }}
      handleStyle={{ paddingTop: 10, paddingBottom: 8 }}
      handleIndicatorStyle={{ backgroundColor: colors.handle, width: 40, height: 5, borderRadius: 3, opacity: 0.55 }}
      accessibilityViewIsModal
    >
      <InSheet.Provider value>
        {typeof children === 'function' ? (
          children({ header: hasHeader ? header : null, bottomPadding })
        ) : (
          <BottomSheetScrollView
            keyboardShouldPersistTaps="handled"
            stickyHeaderIndices={hasHeader ? [0] : undefined}
            contentContainerStyle={{ paddingBottom: bottomPadding }}
          >
            {hasHeader && header}
            {body}
          </BottomSheetScrollView>
        )}
      </InSheet.Provider>
    </BottomSheetModal>
  );
});
