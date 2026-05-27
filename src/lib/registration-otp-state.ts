export type PendingRegistrationOtpState = {
  phoneCountryCode: string;
  phoneNumber: string;
  phoneFull: string;
  createdAt: number;
};

const STORAGE_KEY = "pupillo-registration-otp-phone";
const MAX_AGE_MS = 30 * 60 * 1000;

function isPendingRegistrationOtpState(value: unknown): value is PendingRegistrationOtpState {
  if (!value || typeof value !== "object") return false;
  const state = value as Record<string, unknown>;
  return (
    typeof state.phoneCountryCode === "string" &&
    typeof state.phoneNumber === "string" &&
    typeof state.phoneFull === "string" &&
    typeof state.createdAt === "number"
  );
}

export function readPendingRegistrationOtpState(): PendingRegistrationOtpState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isPendingRegistrationOtpState(parsed) || Date.now() - parsed.createdAt > MAX_AGE_MS) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function savePendingRegistrationOtpState(input: Omit<PendingRegistrationOtpState, "createdAt">) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...input, createdAt: Date.now() } satisfies PendingRegistrationOtpState),
  );
}

export function clearPendingRegistrationOtpState() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}