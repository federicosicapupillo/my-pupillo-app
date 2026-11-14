export type ContactVerification = {
  phone_verified?: boolean | null;
  email?: string | null;
  email_otp_verified_at?: string | null;
  email_otp_verified_address?: string | null;
};

// Legacy phone checks remain valid, but an email OTP never sets phone_verified.
export function hasVerifiedContact(profile: ContactVerification | null | undefined): boolean {
  return profile?.phone_verified === true || !!(
    profile?.email_otp_verified_at && profile.email &&
    profile.email_otp_verified_address === profile.email
  );
}