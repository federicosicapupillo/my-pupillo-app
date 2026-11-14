import { describe, expect, it } from 'vitest';
import { hasVerifiedContact } from '../contact-verification';

describe('Email OTP contact completion', () => {
  it('accepts confirmed account email without verifying the phone', () => {
    expect(hasVerifiedContact({ phone_verified: false, email: 'owner@example.test', email_otp_verified_address: 'owner@example.test', email_otp_verified_at: '2026-11-14T00:00:00Z' })).toBe(true);
  });
  it('rejects a confirmation for a different email', () => {
    expect(hasVerifiedContact({ phone_verified: false, email: 'new@example.test', email_otp_verified_address: 'old@example.test', email_otp_verified_at: '2026-11-14T00:00:00Z' })).toBe(false);
  });
  it('rejects an unconfirmed contact', () => {
    expect(hasVerifiedContact({ phone_verified: false, email: 'owner@example.test' })).toBe(false);
  });
  it('preserves legacy phone completion', () => {
    expect(hasVerifiedContact({ phone_verified: true })).toBe(true);
  });
});