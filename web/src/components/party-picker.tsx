/**
 * Pickers that can also add what isn't there yet: type to search the list, and when the name
 * isn't on it, "Add “…”" creates it on the spot and picks it, so a forgotten supplier, client
 * or wood type no longer means leaving a half-filled form.
 *
 *  - SearchAddPicker: the generic combobox (Radix Popover + cmdk).
 *  - PartyPicker: suppliers / clients (POST /suppliers or /clients with just the name; phone,
 *    address and GST can be filled in later on the party's page).
 */
import { CheckIcon, ChevronDownIcon, Loader2Icon, PlusIcon } from 'lucide-react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { useState } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { api } from '../api';
import { useI18n } from '../i18n';
import { useToast } from './toast';

export interface PickOption {
  value: string;
  label: string;
  hint?: string | null;
}

/** Same squashing the mobile picker uses, so "Sri Ram" finds "sriram". */
const squash = (s: string) => s.toLowerCase().replace(/\s+/g, '');

export function SearchAddPicker({
  id,
  options,
  value,
  onChange,
  onCreate,
  noneLabel,
  placeholder,
  maxLength = 120,
}: {
  id?: string;
  options: PickOption[];
  /** the picked value, '' for none */
  value: string;
  onChange: (value: string) => void;
  /** adds the typed name; resolves to the option to pick. Leave out to offer no "Add". */
  onCreate?: (name: string) => Promise<PickOption>;
  /** when given, a "none" choice with this label is offered */
  noneLabel?: string;
  /** trigger text while nothing is picked */
  placeholder?: string;
  maxLength?: number;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  // shown until the page's own list has been reloaded with them
  const [added, setAdded] = useState<PickOption[]>([]);

  const all = [...options, ...added.filter((a) => !options.some((o) => o.value === a.value))];
  const selected = all.find((o) => o.value === value);
  const name = q.trim().replace(/\s+/g, ' ');
  const exact = name !== '' && all.some((o) => squash(o.label) === squash(name));

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setQ('');
  };

  async function create() {
    if (!onCreate || !name || busy) return;
    setBusy(true);
    try {
      const row = await onCreate(name);
      setAdded((a) => [...a, row]);
      pick(row.value);
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQ('');
      }}
    >
      <PopoverPrimitive.Trigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-control-border bg-control px-3.5 py-2 text-left text-sm font-medium transition-[color,background-color,border-color,box-shadow] duration-200 outline-none hover:bg-control-hover focus-visible:border-ring focus-visible:bg-card focus-visible:ring-[3px] focus-visible:ring-ring/25',
            !selected && 'text-muted-foreground',
          )}
        >
          <span className="truncate">{selected?.label ?? (value || noneLabel || placeholder || '')}</span>
          <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className="z-50 w-(--radix-popover-trigger-width) min-w-[16rem] overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-float data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <Command
            // our own matching: cmdk's fuzzy score would also show loosely related names.
            // (Enter on the highlighted "Add …" row adds the typed name.)
            filter={(itemValue, search, keywords) => (itemValue.startsWith('__') || squash((keywords ?? []).join(' ')).includes(squash(search)) ? 1 : 0)}
          >
            <CommandInput value={q} onValueChange={setQ} placeholder={onCreate ? t('searchOrAddName') : t('search')} maxLength={maxLength} />
            <CommandList>
              <CommandEmpty>{t('noResults')}</CommandEmpty>
              <CommandGroup>
                {noneLabel && !name && (
                  <CommandItem value="__none" onSelect={() => pick('')}>
                    <span className="flex-1 text-muted-foreground">{noneLabel}</span>
                    {!value && <CheckIcon />}
                  </CommandItem>
                )}
                {all.map((o) => (
                  // the value keeps two options with the same label apart
                  <CommandItem key={o.value} value={`${o.label} ${o.value}`} keywords={[o.label, o.hint ?? '']} onSelect={() => pick(o.value)}>
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {o.hint && <span className="text-xs text-muted-foreground">{o.hint}</span>}
                    {o.value === value && <CheckIcon />}
                  </CommandItem>
                ))}
                {onCreate && name.length >= 2 && !exact && (
                  <CommandItem value="__add" onSelect={() => void create()} disabled={busy} className="font-semibold text-primary">
                    {busy ? <Loader2Icon className="animate-spin" /> : <PlusIcon className="text-primary" />}
                    {t('addNamed', { name })}
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export interface PartyOption {
  id: string;
  name: string;
  phone?: string | null;
}

export function PartyPicker({
  id,
  path,
  items,
  value,
  onChange,
  onCreated,
  noneLabel,
}: {
  id?: string;
  path: '/suppliers' | '/clients';
  items: PartyOption[] | null;
  /** the picked id, '' for none */
  value: string;
  onChange: (id: string) => void;
  /** after a party was added: reload the page's list */
  onCreated?: (row: PartyOption) => void;
  noneLabel: string;
}) {
  const { t } = useI18n();
  const toast = useToast();
  return (
    <SearchAddPicker
      id={id}
      options={(items ?? []).map((p) => ({ value: p.id, label: p.name, hint: p.phone }))}
      value={value}
      onChange={onChange}
      noneLabel={noneLabel}
      onCreate={async (name) => {
        const row = await api<PartyOption>(path, { method: 'POST', body: JSON.stringify({ name }) });
        toast(t('partyAdded', { name: row.name }));
        onCreated?.(row);
        return { value: row.id, label: row.name, hint: row.phone };
      }}
    />
  );
}
