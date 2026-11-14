export type ContactVerification = {
  phone_verified?: boolean | null;
  email?: string | null;
  email_otp_verified_at?: string | null;
  email_otp_verified_address?: string | null;
  contact_phone_locked_at?: string | null;
};

// Legacy phone checks remain valid, but an email OTP never sets phone_verified.
export function hasVerifiedContact(profile: ContactVerification | null | undefined): boolean {
  return profile?.phone_verified === true || !!(
    profile?.email_otp_verified_at && profile.email &&
    profile.email_otp_verified_address === profile.email
  );
}

// Phone immutability is independent of email verification and survives email changes.
export function isContactPhoneLocked(profile: ContactVerification | null | undefined): boolean {
  return profile?.phone_verified === true || !!(profile?.contact_phone_locked_at || profile?.email_otp_verified_at);
}