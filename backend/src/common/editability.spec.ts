import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { assertEditable, assertVisible, canEdit } from './editability';
import type { AuthUser } from './types';

const owner: AuthUser = { id: 'o', millId: 'm', name: 'O', username: 'o', role: 'OWNER' };
const acc: AuthUser = { id: 'a', millId: 'm', name: 'A', username: 'a', role: 'ACCOUNTANT' };
const other: AuthUser = { id: 'b', millId: 'm', name: 'B', username: 'b', role: 'ACCOUNTANT' };

describe('editability', () => {
  it('accountant edits own DRAFT and REJECTED entries', () => {
    expect(assertEditable(acc, { createdById: 'a', status: 'DRAFT' })).toBe('UPDATE');
    expect(assertEditable(acc, { createdById: 'a', status: 'REJECTED' })).toBe('UPDATE');
  });

  it('accountant cannot edit submitted or approved entries', () => {
    expect(() => assertEditable(acc, { createdById: 'a', status: 'SUBMITTED' })).toThrow(ConflictException);
    expect(() => assertEditable(acc, { createdById: 'a', status: 'APPROVED' })).toThrow(ConflictException);
    expect(canEdit(acc, { createdById: 'a', status: 'APPROVED' })).toBe(false);
  });

  it("accountant cannot edit someone else's entry", () => {
    expect(() => assertEditable(other, { createdById: 'a', status: 'DRAFT' })).toThrow(ForbiddenException);
  });

  it('owner edits anything; approved edits are flagged OWNER_EDIT', () => {
    expect(assertEditable(owner, { createdById: 'a', status: 'DRAFT' })).toBe('UPDATE');
    expect(assertEditable(owner, { createdById: 'a', status: 'APPROVED' })).toBe('OWNER_EDIT');
  });

  it("accountants cannot see each other's entries (reported as not found)", () => {
    expect(() => assertVisible(other, { createdById: 'a' })).toThrow(NotFoundException);
    expect(assertVisible(owner, { createdById: 'a' })).toBeTruthy();
    expect(assertVisible(acc, { createdById: 'a' })).toBeTruthy();
  });
});
