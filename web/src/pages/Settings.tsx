import { cleanWoodTypeList, matchWoodType } from "@timbertrail/shared";
import { PlusIcon, RotateCcwIcon, SaveIcon, XIcon } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { api } from "../api";
import { useAuth } from "../auth";
import { useLoad } from "../components/common";
import { useLeaveGuard } from "../components/leave-guard";
import {
  Field,
  FormCard,
  FormSection,
  LoadState,
  Notice,
  OwnerOnly,
  Page,
  PageHeader,
} from "../components/page";
import { useToast } from "../components/toast";
import { Lang, useI18n } from "../i18n";

interface MillSettings {
  name: string;
  code: string;
  defaultUnloadingRatePerHour: number | null;
  defaultLanguage: "en" | "ta";
  utcOffsetMinutes: number;
  woodTypes: string[];
}
/** `woods` holds the list joined by new lines, so "changed?" stays a plain string comparison */
type Form = {
  name: string;
  rate: string;
  lang: "en" | "ta";
  offset: string;
  woods: string;
};
const splitWoods = (w: string) => (w ? w.split("\n") : []);

/** Common offsets; the mill's current value is always offered even if it isn't listed. */
const OFFSETS = [
  -300, -240, 0, 60, 120, 180, 240, 270, 300, 330, 345, 360, 390, 420, 480, 540,
  570, 600, 660, 720,
];
const offsetLabel = (m: number) => {
  const sign = m < 0 ? "−" : "+";
  const a = Math.abs(m);
  return `UTC${sign}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}${m === 330 ? " (IST)" : ""}`;
};
const toForm = (d: MillSettings): Form => ({
  name: d.name,
  rate:
    d.defaultUnloadingRatePerHour == null
      ? ""
      : String(d.defaultUnloadingRatePerHour),
  lang: d.defaultLanguage,
  offset: String(d.utcOffsetMinutes),
  woods: d.woodTypes.join("\n"),
});

/** English / தமிழ், as two buttons. */
function LanguageChoice({
  value,
  onChange,
  label,
}: {
  value: Lang;
  onChange: (l: Lang) => void;
  label: string;
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={value}
      onValueChange={(v) => v && onChange(v as Lang)}
      className="h-11 w-fit bg-card"
      aria-label={label}
    >
      <ToggleGroupItem
        value="en"
        className="h-11 px-5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
      >
        English
      </ToggleGroupItem>
      <ToggleGroupItem
        value="ta"
        className="h-11 px-5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
      >
        தமிழ்
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

/** [OWNER-ONLY] Mill-wide defaults, in six plain sections with one Save for the lot. */
export function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { refreshProfile } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useLoad(
    () => api<MillSettings>("/settings"),
    [],
  );
  const [form, setForm] = useState<Form | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setForm(toForm(data));
  }, [data]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setSaveError(null);
    try {
      await api("/settings", {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name,
          defaultUnloadingRatePerHour:
            form.rate.trim() === "" ? null : Number(form.rate),
          defaultLanguage: form.lang,
          utcOffsetMinutes: Number(form.offset),
          woodTypes: splitWoods(form.woods),
        }),
      });
      toast(t("saved"));
      reload();
      await refreshProfile(); // the mill name in the sidebar
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const offsets =
    form && !OFFSETS.includes(Number(form.offset))
      ? [...OFFSETS, Number(form.offset)].sort((a, b) => a - b)
      : OFFSETS;
  const saved = data ? toForm(data) : null;
  const dirty =
    !!form &&
    !!saved &&
    (Object.keys(saved) as (keyof Form)[]).some((k) => form[k] !== saved[k]);
  // saving makes form and saved equal again, which lifts the guard
  useLeaveGuard(dirty);

  const units: [string, string][] = [
    [t("unitsLogs"), t("unitsLogsValue")],
    [t("unitsSawn"), t("unitsSawnValue")],
    [t("unitsVolume"), t("unitsVolumeValue")],
    [t("unitsMoney"), t("unitsMoneyValue")],
  ];

  return (
    <Page className="max-w-5xl">
      <PageHeader
        title={t("settings")}
        badge={<OwnerOnly />}
        subtitle={t("settingsSubtitle")}
      />
      <LoadState loading={loading && !data} error={error} onRetry={reload} />

      {data && form && (
        <FormCard onSubmit={save} className="py-7 [&_form]:gap-7">
          <FormSection
            step={1}
            title={t("secMillInfo")}
            description={t("secMillInfoSub")}
          >
            <Field id="mill-name" label={t("millName")} required>
              <Input
                id="mill-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                minLength={2}
                maxLength={120}
              />
            </Field>
            <Field
              id="mill-code"
              label={t("millCode")}
              hint={t("millCodeHint")}
            >
              <Input id="mill-code" value={data.code} disabled readOnly />
            </Field>
          </FormSection>

          <FormSection
            step={2}
            title={t("secUnloadingRate")}
            description={t("secUnloadingRateSub")}
          >
            <Field
              id="mill-rate"
              label={t("defaultUnloadingRate")}
              hint={t("defaultUnloadingRateHint")}
              className="sm:col-span-2"
            >
              <Input
                id="mill-rate"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={form.rate}
                onChange={(e) => setForm({ ...form, rate: e.target.value })}
                className="tabular-nums sm:max-w-56"
              />
            </Field>
          </FormSection>

          {/* nothing to set: shown so the owner can see what every figure is measured in */}
          <FormSection
            step={3}
            title={t("secUnits")}
            description={t("secUnitsSub")}
          >
            <dl className="grid gap-x-8 gap-y-5 sm:col-span-2 sm:grid-cols-2">
              {units.map(([label, value]) => (
                <div key={label} className="border-l-2 pl-4">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 text-sm font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </FormSection>

          <FormSection
            step={4}
            title={t("secMyLanguage")}
            description={t("secMyLanguageSub")}
          >
            <Field label={t("myLanguage")} className="sm:col-span-2">
              <LanguageChoice
                value={lang}
                onChange={setLang}
                label={t("myLanguage")}
              />
            </Field>
          </FormSection>

          <FormSection
            step={5}
            title={t("secTimeZone")}
            description={t("secTimeZoneSub")}
          >
            <Field
              label={t("timeZone")}
              hint={t("timeZoneHint")}
              className="sm:col-span-2"
            >
              <Select
                value={form.offset}
                onValueChange={(v) => setForm({ ...form, offset: v })}
              >
                <SelectTrigger
                  className="w-full sm:max-w-56"
                  aria-label={t("timeZone")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {offsets.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {offsetLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FormSection>

          <FormSection
            step={6}
            title={t("secNewUserLanguage")}
            description={t("secNewUserLanguageSub")}
          >
            <Field label={t("defaultLanguage")} className="sm:col-span-2">
              <LanguageChoice
                value={form.lang}
                onChange={(l) => setForm({ ...form, lang: l })}
                label={t("defaultLanguage")}
              />
            </Field>
          </FormSection>

          <FormSection
            step={7}
            title={t("woodTypes")}
            description={t("woodTypesSub")}
          >
            <WoodTypesEditor
              value={splitWoods(form.woods)}
              onChange={(list) => setForm({ ...form, woods: list.join("\n") })}
            />
          </FormSection>

          {saveError && <Notice tone="error">{saveError}</Notice>}

          {/* one Save for sections 1, 2, 5, 6 and 7; it stays in view while there is something to save */}
          <div
            className={cn(
              "flex flex-col-reverse gap-2 border-t border-border/70 pt-5 sm:flex-row sm:items-center",
              dirty &&
                "sticky bottom-0 -mx-5 -mb-7 rounded-b-xl bg-card px-5 pb-6 sm:-mx-7 sm:px-7",
            )}
          >
            <p
              className={cn(
                "text-sm sm:mr-auto",
                dirty ? "font-medium text-warning" : "text-muted-foreground",
              )}
              aria-live="polite"
            >
              {t(dirty ? "unsavedChanges" : "noChanges")}
            </p>
            <Button
              type="button"
              variant="ghost"
              disabled={!dirty || busy}
              onClick={() => saved && setForm(saved)}
            >
              <RotateCcwIcon /> {t("discardChanges")}
            </Button>
            <Button type="submit" disabled={!dirty || busy}>
              <SaveIcon /> {t("saveChanges")}
            </Button>
          </div>
        </FormCard>
      )}
    </Page>
  );
}

/** The mill's wood types as removable chips, with an add box. Saved with the rest of the page. */
function WoodTypesEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (list: string[]) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const name = draft.trim().replace(/\s+/g, " ");
  const exists = !!name && matchWoodType(value, name) != null;
  const canAdd = name.length >= 2 && name.length <= 60 && !exists;
  const add = () => {
    if (!canAdd) return;
    onChange(cleanWoodTypeList([...value, name]));
    setDraft("");
  };
  return (
    <div className="flex flex-col gap-3 sm:col-span-2">
      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noWoodTypes")}</p>
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label={t("woodTypes")}>
          {value.map((w) => (
            <li
              key={w}
              className="inline-flex items-center gap-1 rounded-full border bg-card py-1 pr-1 pl-3 text-sm font-medium"
            >
              {w}
              <button
                type="button"
                className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`${t("delete")} ${w}`}
                onClick={() => onChange(value.filter((x) => x !== w))}
              >
                <XIcon className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2 sm:max-w-md">
        <Input
          value={draft}
          placeholder={t("newWoodType")}
          aria-label={t("newWoodType")}
          maxLength={60}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter adds the name instead of submitting the whole settings form
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={!canAdd}
          onClick={add}
        >
          <PlusIcon /> {t("addWoodType")}
        </Button>
      </div>
      {exists && <p className="text-xs text-warning">{t("woodTypeExists")}</p>}
      <p className="text-xs text-muted-foreground">{t("woodTypeRemoveNote")}</p>
    </div>
  );
}
