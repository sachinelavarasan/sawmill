/**
 * [OWNER-ONLY] A supplier's or client's statement: every approved load billed to them and
 * every payment against those loads, oldest first, with the running balance. Print / Save as
 * PDF gives a sheet to hand over or send.
 */
import type { PaymentMode } from "@timbertrail/shared";
import { PrinterIcon } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
import { money2, num3, useApi } from "../components/common";
import {
  LoadState,
  numCell,
  Page,
  PageHeader,
  Stat,
  StatGrid,
  TableCard,
} from "../components/page";
import { modeKey } from "../components/payments";
import { useI18n } from "../i18n";
import { dateOnly } from "./Production";

interface Entry {
  date: string;
  type: "BILL" | "PAYMENT";
  amount: number;
  balance: number;
  loadId: string;
  loadCode: string;
  cft: number | null;
  mode: PaymentMode | null;
  reference: string | null;
}
interface Statement {
  party: {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    gstNumber: string | null;
  };
  entries: Entry[];
  totals: { billed: number; paid: number; balance: number };
}

export function StatementPage() {
  const { kind = "suppliers", id } = useParams<{
    kind: "suppliers" | "clients";
    id: string;
  }>();
  const { t } = useI18n();
  const isSupplier = kind === "suppliers";
  const { data, loading, error, reload } = useApi<Statement>(
    `/${isSupplier ? "suppliers" : "clients"}/${id}/statement`,
  );
  const loadPath = isSupplier ? "/imports" : "/exports";
  const p = data?.party;

  return (
    <Page>
      <PageHeader
        back={{
          to: isSupplier ? "/suppliers" : "/clients",
          label: isSupplier ? t("suppliers") : t("clients"),
        }}
        eyebrow={t("statement")}
        title={p?.name ?? "…"}
        subtitle={
          p
            ? [
                p.phone,
                p.gstNumber && `${t("gstNumber")}: ${p.gstNumber}`,
                p.address,
              ]
                .filter(Boolean)
                .join(" · ") || t("statementSub")
            : undefined
        }
        actions={
          <Button
            variant="outline"
            className="print:hidden"
            onClick={() => window.print()}
            disabled={!data}
          >
            <PrinterIcon /> {t("printSavePdf")}
          </Button>
        }
      />
      <LoadState loading={loading && !data} error={error} onRetry={reload} />
      {data && (
        <>
          <StatGrid className="lg:grid-cols-3">
            <Stat label={t("billed")} value={money2(data.totals.billed)} />
            <Stat
              label={isSupplier ? t("totalPaid") : t("totalReceived")}
              value={money2(data.totals.paid)}
            />
            <Stat
              label={t("balance")}
              value={money2(data.totals.balance)}
              tone={data.totals.balance > 0 ? "warn" : undefined}
            />
          </StatGrid>
          <p className="-mt-2 text-sm text-muted-foreground">
            {t("statementSub")}
          </p>
          <TableCard
            empty={data.entries.length === 0}
            emptyText={t("noStatement")}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4 sm:pl-5">{t("date")}</TableHead>
                  <TableHead>{t("statementEntry")}</TableHead>
                  <TableHead className={numCell}>{t("billed")}</TableHead>
                  <TableHead className={numCell}>
                    {isSupplier ? t("totalPaid") : t("totalReceived")}
                  </TableHead>
                  <TableHead className={cn(numCell, "pr-4 sm:pr-5")}>
                    {t("balance")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.entries.map((e, i) => (
                  <TableRow key={`${e.type}-${e.loadId}-${i}`}>
                    <TableCell className="pl-4 whitespace-nowrap sm:pl-5">
                      {dateOnly(e.date)}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <span className="font-medium">
                        {e.type === "BILL"
                          ? t("billEntry")
                          : `${t("paymentEntry")} · ${t(modeKey(e.mode!))}`}
                      </span>{" "}
                      <Link
                        to={`${loadPath}/${e.loadId}`}
                        className="text-primary hover:underline print:text-foreground print:no-underline"
                      >
                        {e.loadCode}
                      </Link>
                      <div
                        className={cn(
                          "text-xs text-muted-foreground",
                          !e.cft && !e.reference && "hidden",
                        )}
                      >
                        {e.type === "BILL" && e.cft != null
                          ? `${num3(e.cft)} CFT`
                          : e.reference}
                      </div>
                    </TableCell>
                    <TableCell className={numCell}>
                      {e.type === "BILL" ? money2(e.amount) : ""}
                    </TableCell>
                    <TableCell className={numCell}>
                      {e.type === "PAYMENT" ? money2(e.amount) : ""}
                    </TableCell>
                    <TableCell
                      className={cn(numCell, "pr-4 font-semibold sm:pr-5")}
                    >
                      {money2(e.balance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="pl-4 sm:pl-5" colSpan={2}>
                    {t("total")}
                  </TableCell>
                  <TableCell className={numCell}>
                    {money2(data.totals.billed)}
                  </TableCell>
                  <TableCell className={numCell}>
                    {money2(data.totals.paid)}
                  </TableCell>
                  <TableCell
                    className={cn(numCell, "pr-4 font-semibold sm:pr-5")}
                  >
                    {money2(data.totals.balance)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </TableCard>
        </>
      )}
    </Page>
  );
}
