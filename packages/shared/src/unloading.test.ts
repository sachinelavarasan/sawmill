import { test } from 'node:test';
import assert from 'node:assert/strict';
import { durationMinutes, formatDuration, unloadingCharges, UnloadingInputError } from './unloading';

test('unloading: duration in minutes', () => {
  assert.equal(durationMinutes('2026-11-13T09:00:00Z', '2026-11-13T11:30:00Z'), 150);
  assert.equal(durationMinutes('2026-11-13T23:40:00Z', '2026-11-14T00:25:00Z'), 45); // across midnight
});

test('unloading: end before start is rejected', () => {
  assert.throws(() => durationMinutes('2026-11-13T11:00:00Z', '2026-11-13T10:00:00Z'), UnloadingInputError);
});

test('unloading: charges = rate × minutes / 60', () => {
  assert.equal(unloadingCharges(150, 500), 1250); // 2.5 h × ₹500
  assert.equal(unloadingCharges(45, 600), 450);
  assert.equal(unloadingCharges(10, 350), 58.33);
  assert.equal(unloadingCharges(0, 500), 0);
});

test('unloading: negative rate rejected', () => {
  assert.throws(() => unloadingCharges(60, -1), UnloadingInputError);
});

test('unloading: duration formatting', () => {
  assert.equal(formatDuration(150), '2h 30m');
  assert.equal(formatDuration(45), '45m');
  assert.equal(formatDuration(65), '1h 05m');
});
