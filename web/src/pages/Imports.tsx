import {
  durationMinutes,
  formatDuration,
  Permission,
  unloadingCharges,
} from "@timbertrail/shared";
import { PlusIcon, RulerIcon, SaveIcon } from "lucide-react";
import { FormEvent, ReactNode, useId, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "../api";
import { useAuth } from "../auth";
import { money, num3, useApi, useLoad } from "../components/common";
import { DataTable } from "../components/data-table";
import {
  ListEmpty,
  ListToolbar,
  openColumn,
  PageSum,
  StatusCards,
  useRecordList,
  type ListColumn,
} from "../components/record-list";
import { StatusBadge } from "../components/status-badge";
import { useToast } from "../components/toast";
import { useChangedGuard } from "../components/leave-guard";
import {
  PartyPicker,
  type PartyOption,
  SearchAddPicker,
} from "../components/party-picker";
import {
  Field,
  Fold,
  FormActions,
  FormCard,
  FormSection,
  LoadState,
  Notice,
  Page,
  PageHeader,
} from "../components/page";
import { useI18n } from "../i18n";
import { ImportQuickView } from "./QuickViews";
import { asEvent, DateTimePicker } from "../components/date-picker";
import { LorryPicker } from "../components/lorry-picker";

export interface ImportSummary {
  id: string;
  code: string;
  arrivalAt: string;
  lorryNumber: string;
  driverName: string | null;
  originLocation: string | null;
  /** only sent to people who may see finance (the owner) */
  supplierName: string | null;
  woodType: string;
  totalLogs: number;
  totalCft: number;
  status: string;
  rejectionReason: string | null;
  createdByName: string;
}

/** The fields a person types for an import load. Empty string = not filled in. */
export interface ImportForm {
  arrivalAt: string; // datetime-local value
  lorryNumber: string;
  woodType: string;
  woodCategory: string;
  driverName: string;
  driverMobile: string;
  lorryOwnerName: string;
  lorryOwnerMobile: string;
  originLocation: string;
  notes: string;
}

/** ISO timestamp → value for <input type="datetime-local"> in the browser's time zone. */
export function toLocalInput(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}
export const fromLocalInput = (v: string) =>
  v ? new Date(v).toISOString() : undefined;

export const emptyImportForm = (): ImportForm => ({
  arrivalAt: toLocalInput(new Date()),
  lorryNumber: "",
  woodType: "",
  woodCategory: "",
  driverName: "",
  driverMobile: "",
  lorryOwnerName: "",
  lorryOwnerMobile: "",
  originLocation: "",
  notes: "",
});

export const importFormBody = (f: ImportForm) =>
  JSON.stringify({ ...f, arrivalAt: fromLocalInput(f.arrivalAt) });

const arrivalAt = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
const arrivalDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
const arrivalTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });

/** The few columns the simple view keeps: what it is, when, and where it stands. */
const SIMPLE_COLUMNS = ["code", "arrival", "lorry", "supplier", "cft", "status", "open"];

/** `/imports` lists every load; `/measurement` (openOnly) lists the ones still being measured. */
export function ImportsPage({ openOnly = false }: { openOnly?: boolean }) {
  const { t } = useI18n();
  const { user, simple } = useAuth();
  const isOwner = user?.role === "OWNER";
  const list = useRecordList<ImportSummary>({
    path: "/imports",
    name: "imports",
    hiddenByDefault: ["driver", "origin"],
    simpleColumns: SIMPLE_COLUMNS,
    fixedQuery: openOnly ? "open=1" : undefined,
  });
  const { data, loading, error, reload } = list;
  /** the load shown in the side panel, if any */
  const [peek, setPeek] = useState<ImportSummary | null>(null);

  const allColumns = useMemo(() => {
    const cols: ListColumn<ImportSummary>[] = [
      {
        id: "code",
        header: t("importId"),
        cell: (l) => (
          <>
            <Link
              className="font-semibold text-primary hover:underline"
              to={`/imports/${l.id}`}
            >
              {l.code}
            </Link>
            {/* the columns that fold away on smaller screens repeat here meanwhile */}
            <div className="mt-0.5 text-xs whitespace-normal text-muted-foreground md:hidden">
              {l.lorryNumber} · {l.woodType} · {arrivalAt(l.arrivalAt)}
            </div>
            <div className="mt-0.5 hidden text-xs text-muted-foreground md:block lg:hidden">
              {l.woodType} · {l.totalLogs} {t("logs").toLowerCase()}
            </div>
          </>
        ),
      },
      {
        id: "arrival",
        label: t("arrival"),
        header: t("arrival"),
        from: "md",
        cell: (l) => (
          <>
            <div>{arrivalDay(l.arrivalAt)}</div>
            <div className="text-xs text-muted-foreground">
              {arrivalTime(l.arrivalAt)}
            </div>
          </>
        ),
      },
      {
        id: "lorry",
        label: t("lorry"),
        header: t("lorry"),
        from: "md",
        className: "font-medium",
        cell: (l) => l.lorryNumber,
      },
      {
        id: "driver",
        label: t("driverName"),
        header: t("driverName"),
        from: "xl",
        className: "max-w-40 truncate",
        cell: (l) => l.driverName ?? "—",
      },
    ];
    // the supplier belongs to the purchase record, which only the owner sees
    if (isOwner)
      cols.push({
        id: "supplier",
        label: t("supplier"),
        header: t("supplier"),
        from: "xl",
        className: "max-w-40 truncate",
        cell: (l) => l.supplierName ?? "—",
      });
    cols.push(
      {
        id: "origin",
        label: t("originLocation"),
        header: t("originLocation"),
        from: "xl",
        className: "max-w-48 truncate",
        cell: (l) => l.originLocation ?? "—",
      },
      {
        id: "wood",
        label: t("woodType"),
        header: t("woodType"),
        from: "lg",
        cell: (l) => l.woodType,
      },
      {
        id: "logs",
        label: t("logs"),
        header: t("logs"),
        from: "lg",
        numeric: true,
        cell: (l) => l.totalLogs,
      },
      {
        id: "cft",
        header: t("totalCft"),
        numeric: true,
        className: "font-semibold",
        cell: (l) => num3(l.totalCft),
      },
      {
        id: "status",
        header: t("status"),
        cell: (l) => <StatusBadge status={l.status} />,
      },
    );
    if (isOwner)
      cols.push({
        id: "by",
        label: t("createdBy"),
        header: t("createdBy"),
        from: "xl",
        className: "max-w-36 truncate",
        cell: (l) => l.createdByName,
      });
    cols.push(
      openOnly
        ? {
            id: "open",
            header: <span className="sr-only">{t("actions")}</span>,
            className: "w-px text-right",
            cell: (l) => (
              <Button asChild variant="outline" size="sm">
                <Link to={`/imports/${l.id}?from=measure#logs`} aria-label={t("measure")}>
                  <RulerIcon />
                  <span className="max-md:sr-only">{t("measure")}</span>
                </Link>
              </Button>
            ),
          }
        : openColumn<ImportSummary>(
            (l) => `/imports/${l.id}`,
            (l) => l.code,
            t,
          ),
    );
    return cols;
  }, [t, isOwner, openOnly]);
  const columns = useMemo(
    () => list.shown(allColumns),
    [allColumns, list.hidden, list.simple],
  );

  return (
    <Page>
      <PageHeader
        title={
          simple
            ? t(openOnly ? "simpleMeasure" : "simpleLoadIn")
            : t(openOnly ? "measurement" : "imports")
        }
        subtitle={simple ? undefined : t(openOnly ? "measurementSub" : "importsSub")}
        actions={
          <Button asChild size={simple ? "lg" : undefined} className={simple ? "h-12 text-base" : undefined}>
            <Link to="/imports/new">
              <PlusIcon /> {t(simple ? "simpleLoadIn" : "newImport")}
            </Link>
          </Button>
        }
      />

      {/* the list at a glance; each card also filters the table to that status */}
      {!openOnly && (
        <StatusCards list={list} totalLabel={t("totalImportLoads")} />
      )}

      <LoadState shape="list" loading={loading && !data} error={error} onRetry={reload} />

      {/* the simple view's measuring list: one big card per lorry, one big button each */}
      {data && openOnly && simple && <MeasureCards loads={data.items} />}

      {data && !(openOnly && simple) && (
        <DataTable
          grid
          data={data.items}
          columns={columns}
          rowKey={(l) => l.id}
          // the measurement list goes straight to log entry; the full list opens a quick view first
          rowTo={openOnly ? (l) => `/imports/${l.id}?from=measure#logs` : undefined}
          onRowClick={openOnly ? undefined : setPeek}
          selectedKey={peek?.id}
          empty={
            <ListEmpty
              list={list}
              none={t(openOnly ? "noOpenLoads" : "noImports")}
              newTo="/imports/new"
              newLabel={t("newImport")}
            />
          }
          pager={list.paging.pager(data.total)}
          busy={loading}
          toolbar={
            <ListToolbar
              list={list}
              columns={allColumns}
              searchPlaceholder={t("searchRecords")}
            />
          }
          footer={
            <PageSum cft={data.items.reduce((a, l) => a + l.totalCft, 0)} />
          }
        />
      )}

      <ImportQuickView
        row={peek}
        onClose={() => setPeek(null)}
        onChanged={list.refresh}
      />
    </Page>
  );
}

/** Loads still being measured, as big cards: lorry, wood, how far along, and one Measure button. */
function MeasureCards({ loads }: { loads: ImportSummary[] }) {
  const { t } = useI18n();
  if (loads.length === 0)
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-card p-10 text-center shadow-card">
        <p className="text-base text-muted-foreground">{t("noOpenLoads")}</p>
        <Button asChild size="lg" className="h-14 text-base">
          <Link to="/imports/new">
            <PlusIcon /> {t("simpleLoadIn")}
          </Link>
        </Button>
      </div>
    );
  return (
    <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {loads.map((l) => (
        <Link
          key={l.id}
          to={`/imports/${l.id}?from=measure#logs`}
          className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-card hover-lift outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-xl font-bold tracking-wide font-display">{l.lorryNumber}</div>
              <div className="mt-0.5 truncate text-sm text-muted-foreground">
                {l.woodType} · {l.code}
              </div>
            </div>
            <StatusBadge status={l.status} />
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/60 px-4 py-3">
            <div>
              <div className="text-xs text-muted-foreground">{t("logs")}</div>
              <div className="text-2xl leading-tight font-bold tabular-nums font-display">{l.totalLogs}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">CFT</div>
              <div className="text-2xl leading-tight font-bold tabular-nums font-display">{num3(l.totalCft)}</div>
            </div>
          </div>
          <span className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-base font-semibold text-primary-foreground">
            <RulerIcon className="size-5" aria-hidden /> {t("measureNow")}
          </span>
        </Link>
      ))}
    </div>
  );
}

/**
 * The import form, in numbered sections, shared by "New Import" and the edit panel on the
 * detail page. `supplier` and `unloading` are extra parts only the new-import screen has
 * (on an existing load they have their own sections on the page).
 */
/**
 * Wood type: once the owner has a list (Settings → Wood types) it is a picker, so the same
 * wood is never spelled two ways; until then free text with the names already used as suggestions.
 * The API applies the same rule (and saves a known name with its listed spelling).
 */
function WoodTypeField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const woodTypes = useApi<{ items: string[]; fixed: boolean }>("/wood-types");
  const choices = woodTypes.data;
  // the owner can add a missing wood to the list right here, without a trip to Settings
  const canAdd = can(Permission.SETTINGS_MANAGE);
  if (choices?.fixed) {
    // an older load may carry a name since removed from the list: keep it selectable
    const items =
      value && !choices.items.includes(value)
        ? [value, ...choices.items]
        : choices.items;
    return (
      <Field
        id={id}
        label={t("woodType")}
        required
        hint={t(canAdd ? "woodTypeAddHint" : "woodTypeMissing")}
      >
        <SearchAddPicker
          id={id}
          options={items.map((w) => ({ value: w, label: w }))}
          value={value}
          onChange={onChange}
          placeholder={t("pickWoodType")}
          maxLength={60}
          onCreate={
            canAdd
              ? async (name) => {
                  const r = await api<{ name: string }>(
                    "/settings/wood-types",
                    { method: "POST", body: JSON.stringify({ name }) },
                  );
                  toast(t("woodTypeAdded", { name: r.name }));
                  woodTypes.reload();
                  return { value: r.name, label: r.name };
                }
              : undefined
          }
        />
        {/* keeps the browser's "please fill in" check that the old select had */}
        <input
          tabIndex={-1}
          aria-hidden
          required
          value={value}
          onChange={() => undefined}
          className="sr-only"
        />
      </Field>
    );
  }
  return (
    <Field id={id} label={t("woodType")} required hint={t("woodTypeHint")}>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={2}
        maxLength={60}
        list={`${id}-list`}
      />
      <datalist id={`${id}-list`}>
        {choices?.items.map((w) => (
          <option key={w} value={w} />
        ))}
      </datalist>
    </Field>
  );
}

export function ImportFields({
  form,
  onChange,
  supplier,
  unloading,
}: {
  form: ImportForm;
  onChange: (f: ImportForm) => void;
  supplier?: ReactNode;
  unloading?: ReactNode;
}) {
  const { t } = useI18n();
  const { simple } = useAuth();
  const uid = useId();
  const id = (k: keyof ImportForm) => `${uid}-${k}`;
  const set = (k: keyof ImportForm) => (e: { target: { value: string } }) =>
    onChange({ ...form, [k]: e.target.value });

  // every field once; the two views below only arrange them
  const lorry = (
    <Field
      key="lorry"
      id={id("lorryNumber")}
      label={t("lorryNumber")}
      required
      hint={simple ? undefined : t("lorryNumberHint")}
      className={supplier && !simple ? undefined : "sm:col-span-2"}
    >
      <LorryPicker
        id={id("lorryNumber")}
        value={form.lorryNumber}
        required
        onChange={(lorryNumber, known) =>
          onChange({
            ...form,
            lorryNumber,
            // a lorry seen before brings its driver and owner, where those are still empty
            driverName: form.driverName || known?.driverName || "",
            driverMobile: form.driverMobile || known?.driverMobile || "",
            lorryOwnerName: form.lorryOwnerName || known?.lorryOwnerName || "",
            lorryOwnerMobile: form.lorryOwnerMobile || known?.lorryOwnerMobile || "",
          })
        }
      />
    </Field>
  );
  const arrival = (
    <Field key="arrival" id={id("arrivalAt")} label={t("arrivalDateTime")} required>
      <DateTimePicker
        id={id("arrivalAt")}
        value={form.arrivalAt}
        onChange={asEvent(set("arrivalAt"))}
        required
      />
    </Field>
  );
  const wood = (
    <WoodTypeField
      key="wood"
      id={id("woodType")}
      value={form.woodType}
      onChange={(woodType) => onChange({ ...form, woodType })}
    />
  );
  const category = (
    <Field key="category" id={id("woodCategory")} label={t("woodCategory")}>
      <Input
        id={id("woodCategory")}
        value={form.woodCategory}
        onChange={set("woodCategory")}
        maxLength={60}
      />
    </Field>
  );
  const origin = (
    <Field key="origin" id={id("originLocation")} label={t("originLocation")}>
      <Input
        id={id("originLocation")}
        value={form.originLocation}
        onChange={set("originLocation")}
        maxLength={120}
      />
    </Field>
  );
  const people = [
    <Field key="driverName" id={id("driverName")} label={t("driverName")}>
      <Input
        id={id("driverName")}
        value={form.driverName}
        onChange={set("driverName")}
        maxLength={100}
        autoComplete="off"
      />
    </Field>,
    <Field
      key="driverMobile"
      id={id("driverMobile")}
      label={t("driverMobile")}
      hint={t("mobileHint")}
    >
      <Input
        id={id("driverMobile")}
        type="tel"
        value={form.driverMobile}
        onChange={set("driverMobile")}
        inputMode="tel"
        maxLength={15}
        pattern={MOBILE}
        autoComplete="off"
      />
    </Field>,
    <Field key="ownerName" id={id("lorryOwnerName")} label={t("lorryOwnerName")}>
      <Input
        id={id("lorryOwnerName")}
        value={form.lorryOwnerName}
        onChange={set("lorryOwnerName")}
        maxLength={100}
        autoComplete="off"
      />
    </Field>,
    <Field
      key="ownerMobile"
      id={id("lorryOwnerMobile")}
      label={t("lorryOwnerMobile")}
      hint={t("mobileHint")}
    >
      <Input
        id={id("lorryOwnerMobile")}
        type="tel"
        value={form.lorryOwnerMobile}
        onChange={set("lorryOwnerMobile")}
        inputMode="tel"
        maxLength={15}
        pattern={MOBILE}
        autoComplete="off"
      />
    </Field>,
  ];
  const notes = (
    <Field
      key="notes"
      id={id("notes")}
      label={t("notes")}
      hint={simple ? undefined : t("notesHint")}
      className="sm:col-span-2"
    >
      <Textarea
        id={id("notes")}
        value={form.notes}
        onChange={set("notes")}
        maxLength={1000}
        rows={3}
      />
    </Field>
  );

  // the simple view: the four things needed to start measuring, then everything else folded away
  if (simple)
    return (
      <>
        <section className="grid gap-5 sm:grid-cols-2">
          {lorry}
          {wood}
          {arrival}
          {supplier}
        </section>
        <Fold title={t("moreFields")} className="border-t border-border/70 pt-2">
          <div className="grid gap-5 sm:grid-cols-2">
            {category}
            {origin}
            {people}
            {notes}
          </div>
          {unloading && (
            <div className="mt-6 grid gap-5 border-t border-border/70 pt-5 sm:grid-cols-2">
              <h3 className="text-[0.9375rem] font-semibold sm:col-span-2">{t("secUnloading")}</h3>
              {unloading}
            </div>
          )}
        </Fold>
      </>
    );

  let step = 0;
  return (
    <>
      <FormSection
        step={++step}
        title={t("secImportInfo")}
        description={t("secImportInfoSub")}
      >
        {arrival}
        {wood}
        {category}
        {origin}
      </FormSection>

      <FormSection
        step={++step}
        title={t(supplier ? "secSupplierLorry" : "secLorry")}
        description={t("secLorrySub")}
      >
        {supplier}
        {lorry}
        {people}
      </FormSection>

      {unloading && (
        <FormSection
          step={++step}
          title={t("secUnloading")}
          description={t("secUnloadingSub")}
        >
          {unloading}
        </FormSection>
      )}

      <FormSection
        step={++step}
        title={t("secAdditional")}
        description={t("secAdditionalSub")}
      >
        {notes}
      </FormSection>
    </>
  );
}
/** The same rule the server applies to mobile numbers (empty is allowed: the fields are optional). */
const MOBILE = "[0-9+ ]{7,15}";

const emptyUnloading = () => ({
  vehicleNumber: "",
  startAt: "",
  endAt: "",
  ratePerHour: "",
});

/** The sawing a load in was started from (?back=/production/new…), only ever the New Sawing page. */
export function sawingLink(params: URLSearchParams): string | null {
  const back = params.get("back") ?? "";
  return /^\/production\/new(\?|$)/.test(back) ? back : null;
}

export function NewImportPage() {
  const { t } = useI18n();
  const { can, simple } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  // opened from a sawing ("Not in stock? Load in new logs"): its wood, and the way back
  const [params] = useSearchParams();
  const forSawing = sawingLink(params);
  const [form, setForm] = useState(() => ({ ...emptyImportForm(), woodType: params.get("wood") ?? "" }));
  const [unl, setUnl] = useState(emptyUnloading);
  const [supplierId, setSupplierId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** where the pressed button goes after saving: the record, or straight to log entry */
  const next = useRef<"record" | "logs">("record");
  // anything typed or picked since the page opened counts as unsaved
  const release = useChangedGuard([form, unl, supplierId]);

  // the supplier sits on the purchase record, which only the owner may see or set
  const canSupplier =
    can(Permission.FINANCE_VIEW) && can(Permission.SUPPLIERS_MANAGE);
  const suppliers = useLoad(
    () =>
      canSupplier
        ? api<PartyOption[]>("/suppliers")
        : Promise.resolve([]),
    [canSupplier],
  );

  const setU =
    (k: keyof ReturnType<typeof emptyUnloading>) =>
    (e: { target: { value: string } }) =>
      setUnl((u) => ({ ...u, [k]: e.target.value }));
  const hasUnloading = unl.vehicleNumber.trim() !== "";
  // the same formulas the server uses: whole minutes between the times, rate × minutes / 60
  let minutes: number | null = null;
  let charges: number | null = null;
  try {
    if (unl.startAt && unl.endAt)
      minutes = durationMinutes(new Date(unl.startAt), new Date(unl.endAt));
    if (minutes != null && unl.ratePerHour.trim() !== "")
      charges = unloadingCharges(minutes, Number(unl.ratePerHour));
  } catch {
    minutes = charges = null; // end before start, or a bad rate: the inputs say so themselves
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const goTo = next.current;
    next.current = "record";
    setBusy(true);
    setError(null);
    try {
      const created = await api<{ id: string }>("/imports", {
        method: "POST",
        body: importFormBody(form),
      });
      // the load now exists; the optional parts are saved onto it, and a failure there must not lose it
      const missed: string[] = [];
      if (hasUnloading)
        await api(`/imports/${created.id}/unloading`, {
          method: "POST",
          body: JSON.stringify({
            vehicleNumber: unl.vehicleNumber,
            startAt: fromLocalInput(unl.startAt),
            endAt: fromLocalInput(unl.endAt),
            ratePerHour:
              unl.ratePerHour.trim() === ""
                ? undefined
                : Number(unl.ratePerHour),
          }),
        }).catch((err) =>
          missed.push(`${t("secUnloading")} (${(err as Error).message})`),
        );
      if (supplierId)
        await api(`/imports/${created.id}/financials`, {
          method: "PUT",
          body: JSON.stringify({ supplierId }),
        }).catch((err) =>
          missed.push(`${t("supplier")} (${(err as Error).message})`),
        );
      if (missed.length)
        toast(t("savedButNot", { what: missed.join(", ") }), "warn");
      release();
      const carry = forSawing ? `?${new URLSearchParams({ back: forSawing })}` : "";
      navigate(`/imports/${created.id}${carry}${goTo === "logs" ? "#logs" : ""}`, {
        replace: true,
      });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Page className="max-w-5xl">
      <PageHeader
        title={simple ? t("simpleLoadIn") : t("newImport")}
        subtitle={simple ? undefined : t("requiredNote")}
        back={{ to: "/imports", label: t(simple ? "simpleLoadIn" : "imports") }}
      />
      {forSawing && <Notice>{t("loadInForSawing")}</Notice>}
      <FormCard onSubmit={submit} className="py-7 [&_form]:gap-7">
        <ImportFields
          form={form}
          onChange={setForm}
          supplier={
            canSupplier && (
              <Field
                id="imp-supplier"
                label={t("supplier")}
                hint={t("supplierHint")}
              >
                <PartyPicker
                  id="imp-supplier"
                  path="/suppliers"
                  items={suppliers.data}
                  value={supplierId}
                  onChange={setSupplierId}
                  onCreated={suppliers.reload}
                  noneLabel={t("noSupplier")}
                />
              </Field>
            )
          }
          unloading={
            <>
              <Field
                id="imp-unl-vehicle"
                label={t("vehicleNumber")}
                hint={t("unloadingVehicleHint")}
              >
                <Input
                  id="imp-unl-vehicle"
                  value={unl.vehicleNumber}
                  onChange={setU("vehicleNumber")}
                  // only needed once any other unloading detail is filled in
                  required={!!(unl.startAt || unl.endAt || unl.ratePerHour)}
                  minLength={2}
                  maxLength={20}
                  autoCapitalize="characters"
                  className="uppercase"
                />
              </Field>
              <Field
                id="imp-unl-rate"
                label={t("ratePerHour")}
                hint={t("unloadingRateHint")}
              >
                <Input
                  id="imp-unl-rate"
                  type="number"
                  value={unl.ratePerHour}
                  onChange={setU("ratePerHour")}
                  min={0}
                  max={1000000}
                  step="0.01"
                  inputMode="decimal"
                  className="tabular-nums"
                />
              </Field>
              <Field id="imp-unl-start" label={t("startTime")}>
                <DateTimePicker
                  id="imp-unl-start"
                  value={unl.startAt}
                  onChange={asEvent(setU("startAt"))}
                />
              </Field>
              <Field id="imp-unl-end" label={t("endTime")}>
                <DateTimePicker
                  id="imp-unl-end"
                  value={unl.endAt}
                  onChange={asEvent(setU("endAt"))}
                  min={unl.startAt || undefined}
                />
              </Field>
              <div
                className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 rounded-lg bg-muted/60 px-4 py-3 text-sm sm:col-span-2"
                aria-live="polite"
              >
                <span className="text-muted-foreground">
                  {t("duration")}:{" "}
                  <span className="font-semibold text-foreground tabular-nums">
                    {minutes != null ? formatDuration(minutes) : "—"}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  {t("estimatedCharges")}:{" "}
                  <span className="font-semibold text-foreground tabular-nums">
                    {charges != null ? money(charges) : "—"}
                  </span>
                </span>
              </div>
            </>
          }
        />
        {error && <Notice tone="error">{error}</Notice>}
        {simple ? (
          // the simple view: one big button that goes straight on to measuring
          <div className="flex flex-col gap-2 border-t border-border/70 pt-5 sm:flex-row-reverse sm:items-center">
            <Button
              type="submit"
              size="lg"
              className="h-14 text-base sm:min-w-72"
              disabled={busy}
              onClick={() => (next.current = "logs")}
            >
              <RulerIcon className="size-5!" /> {t("startMeasuring")}
            </Button>
            <Button
              type="submit"
              variant="ghost"
              disabled={busy}
              onClick={() => (next.current = "record")}
            >
              <SaveIcon /> {t("saveDraft")}
            </Button>
          </div>
        ) : (
        <div className="border-t border-border/70 pt-5">
          <FormActions summary={t("draftHint")}>
            <Button asChild variant="ghost">
              <Link to="/imports">{t("cancel")}</Link>
            </Button>
            <Button
              type="submit"
              variant="outline"
              disabled={busy}
              onClick={() => (next.current = "record")}
            >
              <SaveIcon /> {t("saveDraft")}
            </Button>
            <Button
              type="submit"
              disabled={busy}
              onClick={() => (next.current = "logs")}
            >
              <RulerIcon /> {t("saveAndMeasure")}
            </Button>
          </FormActions>
        </div>
        )}
      </FormCard>
    </Page>
  );
}
