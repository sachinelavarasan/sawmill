import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CftInputError, exportPieceCft, formatCft, importLogCft, totalCft } from './cft';
import { Permission, Role, hasPermission } from './index';

// ---- Import CFT: (G × G × L) / 2304 ----
test('import: document example L=8ft, G=12in → 0.500', () => {
  assert.equal(importLogCft(12, 8), 0.5);
  assert.equal(formatCft(importLogCft(12, 8)), '0.500');
});

test('import: additional cases', () => {
  assert.equal(importLogCft(24, 10), 2.5);
  assert.equal(importLogCft(36, 12), 6.75);
  assert.equal(importLogCft(18.5, 7.5), 1.114);
});

test('import: rejects zero / negative / NaN', () => {
  assert.throws(() => importLogCft(0, 8), CftInputError);
  assert.throws(() => importLogCft(12, -1), CftInputError);
  assert.throws(() => importLogCft(Number.NaN, 8), CftInputError);
});

// ---- Export CFT: (T × W × L × Pcs) / 144 ----
test('export: document example 4×2, 8ft, 10 pcs → 4.444', () => {
  assert.equal(exportPieceCft(4, 2, 8, 10), 4.444);
});

test('export: Method B table from requirements, total 14.444', () => {
  const lines = [exportPieceCft(4, 2, 8, 10), exportPieceCft(3, 2, 8, 10), exportPieceCft(2, 3, 8, 20)];
  assert.deepEqual(lines, [4.444, 3.333, 6.667]);
  assert.equal(totalCft(lines), 14.444);
});

test('export: additional case 6×4, 12ft, 5 pcs → 10.000', () => {
  assert.equal(exportPieceCft(6, 4, 12, 5), 10);
});

test('export: pieces must be a positive whole number', () => {
  assert.throws(() => exportPieceCft(4, 2, 8, 0), CftInputError);
  assert.throws(() => exportPieceCft(4, 2, 8, 2.5), CftInputError);
});

test('totals: sum of rounded lines is stable for many logs', () => {
  const logs = Array.from({ length: 137 }, () => importLogCft(12, 8));
  assert.equal(totalCft(logs), 68.5);
});

// ---- Permissions ----
test('permissions: accountant cannot see finance, clients, users or approve', () => {
  for (const p of [
    Permission.FINANCE_VIEW,
    Permission.CLIENTS_MANAGE,
    Permission.SUPPLIERS_MANAGE,
    Permission.USERS_MANAGE,
    Permission.OPERATIONS_APPROVE,
    Permission.OPERATIONS_EDIT_APPROVED,
    Permission.REPORTS_FINANCIAL,
    Permission.DASHBOARD_OWNER,
    Permission.SETTINGS_MANAGE,
  ]) {
    assert.equal(hasPermission(Role.ACCOUNTANT, p), false, p);
    assert.equal(hasPermission(Role.OWNER, p), true, p);
  }
});

test('permissions: unknown role has nothing', () => {
  assert.equal(hasPermission('ADMIN', Permission.DASHBOARD_ACCOUNTANT), false);
  assert.equal(hasPermission(undefined, Permission.DASHBOARD_ACCOUNTANT), false);
});
