/** Shapes the API returns (contracts: the backend services; the web pages use the same). */

export type Status = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
export const STATUSES: Status[] = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'];

export interface Paged<T> {
  items: T[];
  total: number;
}

// ── production ──
export interface ProductionSummary {
  id: string;
  code: string;
  productionDate: string;
  importLoadId: string;
  importCode: string;
  woodType: string;
  inputCft: number | null;
  outputCft: number;
  wasteCft: number | null;
  status: Status;
  rejectionReason: string | null;
  createdByName: string;
}

export interface Output {
  id: string;
  thicknessIn: number;
  widthIn: number;
  lengthFt: number;
  pieces: number;
  cft: number;
}

export interface ProductionDetail {
  id: string;
  code: string;
  importLoadId: string;
  importCode: string;
  importLorryNumber: string;
  woodType: string;
  productionDate: string;
  cuttingMachine: string | null;
  machineOperator: string | null;
  workerDetails: string | null;
  startAt: string | null;
  endAt: string | null;
  inputCft: number | null;
  outputCft: number;
  wasteCft: number | null;
  wasteNotes: string | null;
  recoveryPercent: number | null;
  rawAvailableCft: number;
  status: Status;
  rejectionReason: string | null;
  createdByName: string;
  editable: boolean;
  canSubmit: boolean;
  canReview: boolean;
  outputs: Output[];
}

// ── stock ──
export interface RawStockRow {
  importLoadId: string;
  importCode: string;
  woodType: string;
  arrivalAt: string;
  receivedLogs: number;
  receivedCft: number;
  logs: number;
  cft: number;
}

export interface FinishedStockRow {
  woodType: string;
  thicknessIn: number;
  widthIn: number;
  lengthFt: number;
  importLoadId: string;
  importCode: string;
  pieces: number;
  cft: number;
}

export interface Balances {
  totals: { rawCft: number; rawLoads: number; finishedCft: number; finishedPieces: number };
  raw: RawStockRow[];
  finished: FinishedStockRow[];
}

export type MovementSource = 'IMPORT' | 'PRODUCTION_INPUT' | 'PRODUCTION_OUTPUT' | 'EXPORT' | 'ADJUSTMENT';

export interface Movement {
  id: string;
  createdAt: string;
  kind: 'RAW' | 'FINISHED';
  woodType: string;
  importLoadId: string;
  importCode: string;
  thicknessIn: number | null;
  widthIn: number | null;
  lengthFt: number | null;
  piecesDelta: number;
  cftDelta: number;
  source: MovementSource;
  sourceId: string;
  sourceCode: string;
  postedByName: string;
}

export interface Adjustment {
  id: string;
  code: string;
  kind: 'RAW' | 'FINISHED';
  woodType: string;
  importLoadId: string;
  importCode: string;
  thicknessIn: number | null;
  widthIn: number | null;
  lengthFt: number | null;
  piecesDelta: number;
  cftDelta: number;
  reason: string;
  status: Status;
  rejectionReason: string | null;
  createdByName: string;
  createdAt: string;
  editable: boolean;
  canSubmit: boolean;
  canReview: boolean;
}

// ── exports ──
export interface ExportSummary {
  id: string;
  code: string;
  exportDate: string;
  lorryNumber: string;
  woodType: string;
  totalPieces: number;
  totalCft: number;
  status: Status;
  rejectionReason?: string | null;
  createdByName: string;
}

export interface ExportLine {
  id: string;
  lineNumber: number;
  importLoadId: string | null;
  importCode: string;
  thicknessIn: number;
  widthIn: number;
  lengthFt: number;
  pieces: number;
  cft: number;
  availablePieces: number;
}

export interface ExportDetail {
  id: string;
  code: string;
  exportDate: string;
  lorryNumber: string;
  woodType: string;
  driverName: string | null;
  driverMobile: string | null;
  lorryOwnerName: string | null;
  lorryOwnerMobile: string | null;
  startAt: string | null;
  endAt: string | null;
  importLoadId: string | null;
  importCode: string | null;
  notes: string | null;
  totalPieces: number;
  totalCft: number;
  status: Status;
  rejectionReason: string | null;
  createdByName: string;
  editable: boolean;
  canSubmit: boolean;
  canReview: boolean;
  lines: ExportLine[];
}

/** [OWNER-ONLY] */
export interface SaleFinancials {
  clientId: string | null;
  sellingRatePerCft: number | null;
  saleAmount: number | null;
  amountReceived: number;
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
  notes: string | null;
}

/** [OWNER-ONLY] */
export interface PurchaseFinancials {
  supplierId: string | null;
  purchaseRatePerCft: number | null;
  purchaseAmount: number | null;
  transportCharges: number | null;
  amountPaid: number;
  paymentStatus?: 'UNPAID' | 'PARTIAL' | 'PAID';
  notes: string | null;
}

// ── approvals ──
export type ApprovalKind = 'IMPORT' | 'PRODUCTION' | 'EXPORT' | 'ADJUSTMENT';
interface ApprovalBase {
  id: string;
  code: string;
  submittedAt: string;
  createdByName: string;
  woodType: string;
}
export type ApprovalItem =
  | (ApprovalBase & { type: 'IMPORT'; lorryNumber: string; totalLogs: number; totalCft: number })
  | (ApprovalBase & { type: 'PRODUCTION'; importCode: string; inputCft: number | null; outputCft: number; wasteCft: number | null })
  | (ApprovalBase & { type: 'EXPORT'; lorryNumber: string; totalPieces: number; totalCft: number })
  | (ApprovalBase & { type: 'ADJUSTMENT'; kind: 'RAW' | 'FINISHED'; importCode: string; cftDelta: number; piecesDelta: number; reason: string });
export interface ApprovalQueue {
  counts: Record<ApprovalKind, number> & { total: number };
  items: ApprovalItem[];
}

// ── dashboards ──
export interface OwnerDashboard {
  kpis: {
    totalImportLoads: number;
    totalExportLoads: number;
    rawStockCft: number;
    finishedStockCft: number;
    todayImports: number;
    todayExports: number;
    pendingApprovals: number;
    totalSales: number;
    totalExpenses: number;
    pendingReceivables: number;
    pendingPayables: number;
    profitLoss: number;
  };
  accountantActivity: {
    accountantId: string;
    accountantName: string;
    logsMeasured: number;
    totalCft: number;
    pendingEntries: number;
    approvedEntries: number;
    rejectedEntries: number;
  }[];
}

export interface AccountantDashboard {
  kpis: {
    todayImports: number;
    todayExports: number;
    draftEntries: number;
    pendingSubmissions: number;
    approvedEntries: number;
    rejectedEntries: number;
  };
  measurementProgress: {
    id: string;
    code: string;
    lorryNumber: string;
    woodType: string;
    totalLogs: number;
    totalCft: number;
    status: Status;
    rejectionReason: string | null;
  }[];
}

// ── accounts (owner only) ──
export interface PartyBalance {
  id: string | null;
  name: string | null;
  loads: number;
  amount: number;
  balance: number;
  paid?: number;
  received?: number;
}

export interface AccountsSummary {
  period: { from: string; to: string };
  pnl: {
    sales: number;
    purchases: number;
    transport: number;
    unloading: number;
    otherExpenses: { category: string; amount: number }[];
    totalOtherExpenses: number;
    totalExpenses: number;
    profit: number;
  };
  payables: PartyBalance[];
  receivables: PartyBalance[];
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  importLoadId: string | null;
  importCode: string | null;
  notes: string | null;
}

export interface ExpenseList extends Paged<Expense> {
  totalAmount: number;
  categories: string[];
}

export interface Party {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  gstNumber: string | null;
  notes: string | null;
}

// ── admin (owner only) ──
export interface UserRow {
  id: string;
  name: string;
  username: string;
  phone: string | null;
  role: 'OWNER' | 'ACCOUNTANT';
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  ip: string | null;
  user: { name: string; username: string; role: string } | null;
}

export interface MillSettings {
  name: string;
  code: string;
  defaultUnloadingRatePerHour: number | null;
  defaultLanguage: 'en' | 'ta';
  utcOffsetMinutes: number;
}

// ── reports ──
export type ColType = 'text' | 'date' | 'datetime' | 'int' | 'cft' | 'money' | 'percent';

export interface ReportInfo {
  key: string;
  title: string;
  group: 'operational' | 'financial';
  periodic: boolean;
  statusFilter: boolean;
}

export interface ReportData extends ReportInfo {
  millName: string;
  period: { from: string; to: string } | null;
  approvedOnly: boolean | null;
  generatedAt: string;
  columns: { key: string; label: string; type: ColType; total: boolean }[];
  rows: Record<string, string | number | null>[];
  totals: Record<string, number>;
  totalLabel: string;
}
