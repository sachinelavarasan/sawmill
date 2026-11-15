import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanWoodTypeList, matchWoodType, tidyWoodType } from './wood-types';

test('tidy trims and collapses spaces', () => {
  assert.equal(tidyWoodType('  Burma   teak '), 'Burma teak');
});

test('match ignores case and spacing and returns the list spelling', () => {
  const list = ['Teak', 'Burma Teak', 'Pine'];
  assert.equal(matchWoodType(list, 'teak '), 'Teak');
  assert.equal(matchWoodType(list, 'BURMA  TEAK'), 'Burma Teak');
  assert.equal(matchWoodType(list, 'Teek'), null);
});

test('clean list: tidy, drop blanks and repeats (first spelling wins), sort', () => {
  assert.deepEqual(cleanWoodTypeList([' pine', 'Teak', '', 'teak', 'Savukku  ', 'PINE']), ['pine', 'Savukku', 'Teak']);
});
