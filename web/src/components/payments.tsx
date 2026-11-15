/**
 * [OWNER-ONLY] Payments against one load: money paid to the supplier (import) or received
 * from the client (export). Each payment is its own row; the load's paid total and status
 * are worked out by the API from these rows.
 */
import {
  PAYMENT_MODES,
  type PaymentMode,
  type PaymentStatus,
} from "@timbertrail/shared";
import { PlusIcon, Trash2Icon, WalletIcon } from "lucide-react";
import { FormEvent, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { api } from "../api";
import { dateOnly, todayLocal } from "../pages/Production";
import { money2, useLoad } from "./common";
import { useConfirm } from "./confirm";
import { LoadState, Notice, numCell, TableCard, wide } from "./page";
import { useToast } from "./toast";
import { type TKey, useI18n } from "../i18n";

export interface Payment {
  id: string;
  date: string;
  amount: number;
  mode: PaymentMode;
  reference: string | null;
  notes: string | null;
  createdByName: string | null;
}
export interface PaymentSummary {
  items: Payment[];
  billAmount: number | null;
  totalPaid: number;
  paymentStatus: PaymentStatus;
  balance: number;
  overpaid: number;
}

export const PAY_BADGE: Record<
  PaymentStatus,
  { key: TKey; className: string }
> = {
  UNPAID: { key: "unpaid", className: "bg-muted text-muted-foreground" },
  PARTIAL: { key: "partial", className: "bg-warning-soft text-warning" },
  PAID: { key: "paid", className: "bg-success-soft text-success" },
};

export function PayBadge({ status }: { status: PaymentStatus }) {
  const { t } = useI18n();
  const b = PAY_BADGE[status];
  return (
    <Badge
      variant="secondary"
      className={cn(
        "rounded-full border-transparent font-semibold",
        b.className,
      )}
    >
      {t(b.key)}
    </Badge>
  );
}

export const modeKey = (m: PaymentMode) => `mode${m}` as TKey;

/**
 * The payments table with an add row. `onChanged` runs after every add / delete so the
 * page can refresh the figures it shows (amount paid, balance, status).
 */
export function PaymentsPanel({
  kind,
  loadId,
  onChanged,
}: {
  kind: "imports" | "exports";
  loadId: string;
  onChanged?: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const path = `/${kind}/${loadId}/payments`;
  const { data, loading, error, reload } = useLoad(
    () => api<PaymentSummary>(path),
    [path],
  );
  const empty = {
    date: todayLocal(),
    amount: "",
    mode: "BANK" as PaymentMode,
    reference: "",
    notes: "",
  };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const amount = Number(form.amount);
  const canAdd =
    form.amount.trim() !== "" &&
    Number.isFinite(amount) &&
    amount > 0 &&
    form.date !== "" &&
    !busy;

  async function send(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    setProblem(null);
    try {
      await action();
      toast(done);
      reload();
      onChanged?.();
      return true;
    } catch (err) {
      setProblem((err as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!canAdd) return;
    const ok = await send(
      () =>
        api(path, {
          method: "POST",
          body: JSON.stringify({
            date: form.date,
            amount,
            mode: form.mode,
            reference: form.reference,
            notes: form.notes,
          }),
        }),
      t("paymentSaved"),
    );
    if (ok) setForm({ ...empty, mode: form.mode });
  }

  async function remove(p: Payment) {
    const yes = await confirm({
      title: t("deletePayment"),
      description: `${dateOnly(p.date)} · ${t(modeKey(p.mode))} · ${money2(p.amount)}`,
      confirmLabel: t("delete"),
      destructive: true,
    });
    if (yes)
      await send(
        () => api(`${path}/${p.id}`, { method: "DELETE" }),
        t("paymentDeleted"),
      );
  }

  const paidLabel = kind === "imports" ? t("totalPaid") : t("totalReceived");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <WalletIcon className="size-4 text-muted-foreground" aria-hidden />
          {kind === "imports" ? t("payments") : t("paymentsReceived")}
        </h3>
        {data && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <PayBadge status={data.paymentStatus} />
            <span>
              {paidLabel}:{" "}
              <strong className="text-foreground tabular-nums">
                {money2(data.totalPaid)}
              </strong>
            </span>
            {data.billAmount != null && (
              <span>
                {t("balance")}:{" "}
                <strong
                  className={cn(
                    "tabular-nums",
                    data.balance > 0 ? "text-warning" : "text-foreground",
                  )}
                >
                  {money2(data.balance)}
                </strong>
              </span>
            )}
            {data.overpaid > 0 && (
              <span className="text-info">
                {t("overpaid", { amount: money2(data.overpaid) })}
              </span>
            )}
          </div>
        )}
      </div>
      <LoadState loading={loading && !data} error={error} onRetry={reload} />
      {data && (
        <TableCard empty={false}>
          <form
            onSubmit={add}
            className="grid gap-3 border-b border-border/70 p-4 sm:grid-cols-2 lg:grid-cols-[9.5rem_8.5rem_10rem_1fr_auto] sm:p-5"
          >
            <Input
              type="date"
              aria-label={t("date")}
              value={form.date}
              max={todayLocal()}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
            />
            <Input
              type="number"
              aria-label={t("amount")}
              placeholder={t("amount")}
              value={form.amount}
              min={0.01}
              step="0.01"
              inputMode="decimal"
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
            />
            <Select
              value={form.mode}
              onValueChange={(v) =>
                setForm({ ...form, mode: v as PaymentMode })
              }
            >
              <SelectTrigger className="w-full" aria-label={t("paymentMode")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_MODES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {t(modeKey(m))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              aria-label={t("paymentReference")}
              placeholder={
                form.mode === "CASH" ? t("notes") : t("paymentReferenceHint")
              }
              value={form.mode === "CASH" ? form.notes : form.reference}
              maxLength={form.mode === "CASH" ? 500 : 60}
              onChange={(e) =>
                setForm(
                  form.mode === "CASH"
                    ? { ...form, notes: e.target.value }
                    : { ...form, reference: e.target.value },
                )
              }
            />
            <Button type="submit" disabled={!canAdd}>
              <PlusIcon />
              {t("addPayment")}
            </Button>
          </form>
          {problem && (
            <Notice tone="error" className="m-4 sm:m-5">
              {problem}
            </Notice>
          )}
          {data.items.length === 0 ? (
            <div className="px-4 py-4 text-sm text-muted-foreground sm:px-5">
              {t("noPayments")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4 sm:pl-5">{t("date")}</TableHead>
                  <TableHead>{t("paymentMode")}</TableHead>
                  <TableHead className={wide}>
                    {t("paymentReference")}
                  </TableHead>
                  <TableHead className={numCell}>{t("amount")}</TableHead>
                  <TableHead className="w-12 pr-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="pl-4 sm:pl-5">
                      {dateOnly(p.date)}
                    </TableCell>
                    <TableCell>{t(modeKey(p.mode))}</TableCell>
                    <TableCell
                      className={cn(
                        wide,
                        "max-w-64 truncate text-muted-foreground",
                      )}
                      title={[p.reference, p.notes].filter(Boolean).join(" · ")}
                    >
                      {[p.reference, p.notes].filter(Boolean).join(" · ") ||
                        "—"}
                    </TableCell>
                    <TableCell className={cn(numCell, "font-medium")}>
                      {money2(p.amount)}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={t("delete")}
                        disabled={busy}
                        onClick={() => void remove(p)}
                      >
                        <Trash2Icon />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="pl-4 sm:pl-5" colSpan={2}>
                    {paidLabel}
                  </TableCell>
                  <TableCell className={wide} />
                  <TableCell className={cn(numCell, "font-semibold")}>
                    {money2(data.totalPaid)}
                  </TableCell>
                  <TableCell className="pr-4" />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </TableCard>
      )}
    </div>
  );
}
