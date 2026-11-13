/** Typed client for /api/imports (contract: backend/src/imports/imports.controller.ts). */
import { api } from './api';

export type Status = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export interface ImportSummary {
  id: string;
  code: string;
  arrivalAt: string;
  lorryNumber: string;
  woodType: string;
  totalLogs: number;
  totalCft: number;
  status: Status;
  rejectionReason: string | null;
  createdByName: string;
  updatedAt: string;
}

export interface Unloading {
  id: string;
  vehicleNumber: string;
  driverName: string | null;
  driverMobile: string | null;
  vehicleOwnerName: string | null;
  startAt: string;
  endAt: string | null;
  durationMinutes: number | null;
  ratePerHour: number | null;
  totalCharges: number | null;
}

export interface Log {
  id: string;
  logNumber: number;
  girthIn: number;
  lengthFt: number;
  cft: number;
}

export interface ImportDetail extends ImportSummary {
  woodCategory: string | null;
  driverName: string | null;
  driverMobile: string | null;
  lorryOwnerName: string | null;
  lorryOwnerMobile: string | null;
  originLocation: string | null;
  notes: string | null;
  editable: boolean;
  defaultUnloadingRate: number | null;
  unloadings: Unloading[];
  logs: Log[];
}

export interface ImportForm {
  lorryNumber: string;
  woodType: string;
  woodCategory: string;
  driverName: string;
  driverMobile: string;
  lorryOwnerName: string;
  lorryOwnerMobile: string;
  originLocation: string;
}

export interface Totals {
  totalLogs: number;
  totalCft: number;
}

const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

export const importsApi = {
  list: (opts: { open?: boolean } = {}) =>
    api<{ items: ImportSummary[]; total: number }>(`/imports?take=100${opts.open ? '&open=1' : ''}`),
  get: (id: string) => api<ImportDetail>(`/imports/${id}`),
  create: (f: ImportForm) => api<ImportDetail>('/imports', json('POST', f)),
  update: (id: string, f: Partial<ImportForm>) => api<ImportDetail>(`/imports/${id}`, json('PATCH', f)),

  startUnloading: (id: string, b: { vehicleNumber: string; driverName?: string; ratePerHour?: number }) =>
    api<Unloading>(`/imports/${id}/unloading`, json('POST', b)),
  endUnloading: (id: string, uid: string) =>
    api<Unloading>(`/imports/${id}/unloading/${uid}`, json('PATCH', { endAt: new Date().toISOString() })),
  removeUnloading: (id: string, uid: string) => api<void>(`/imports/${id}/unloading/${uid}`, json('DELETE')),

  addLog: (id: string, girthIn: number, lengthFt: number) =>
    api<{ log: Log } & Totals>(`/imports/${id}/logs`, json('POST', { girthIn, lengthFt })),
  updateLog: (id: string, logId: string, girthIn: number, lengthFt: number) =>
    api<{ log: Log } & Totals>(`/imports/${id}/logs/${logId}`, json('PATCH', { girthIn, lengthFt })),
  removeLog: (id: string, logId: string) => api<Totals>(`/imports/${id}/logs/${logId}`, json('DELETE')),
};
