import { test } from 'node:test';
import assert from 'node:assert/strict';
import { productionWaste, recoveryPercent, sizeLabel } from './production';

test('waste is input minus output, rounded to 3 decimals', () => {
  assert.equal(productionWaste(20, 14.444), 5.556);
  assert.equal(productionWaste(0.3, 0.1), 0.2); // no float artefacts
});

test('waste goes negative when the output measured more than the input', () => {
  assert.equal(productionWaste(10, 10.5), -0.5);
});

test('recovery is output / input as a percentage with 1 decimal', () => {
  assert.equal(recoveryPercent(20, 14.444), 72.2);
});

test('recovery is null when no input has been entered', () => {
  assert.equal(recoveryPercent(null, 5), null);
  assert.equal(recoveryPercent(0, 5), null);
});

test('size label prints thickness × width in inches and length in feet', () => {
  assert.equal(sizeLabel(4, 2, 8), '4 × 2 in × 8 ft');
});
