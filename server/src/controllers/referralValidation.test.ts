import { describe, expect, it } from 'vitest';
import { createReferralSchema, updateStatusSchema, listReferralQuerySchema } from './referralController.js';

describe('referral request validation', () => {
  it('normalizes valid referral input and supplies an empty note by default', () => {
    expect(createReferralSchema.parse({ candidateEmail: '  candidate@example.com  ' })).toEqual({
      candidateEmail: 'candidate@example.com',
      note: ''
    });
  });

  it('rejects malformed email addresses and unexpected fields', () => {
    expect(createReferralSchema.safeParse({ candidateEmail: 'not-an-email' }).success).toBe(false);
    expect(createReferralSchema.safeParse({ candidateEmail: 'candidate@example.com', organizationId: 'other-tenant' }).success).toBe(false);
  });

  it('accepts only supported referral statuses', () => {
    expect(updateStatusSchema.safeParse({ status: 'accepted' }).success).toBe(true);
    expect(updateStatusSchema.safeParse({ status: 'archived' }).success).toBe(false);
  });

  it('validates query filters and applies pagination defaults', () => {
    expect(listReferralQuerySchema.parse({})).toMatchObject({ page: 1, limit: 20 });
    expect(listReferralQuerySchema.safeParse({ page: '0' }).success).toBe(false);
    expect(listReferralQuerySchema.safeParse({ status: 'archived' }).success).toBe(false);
  });
});
