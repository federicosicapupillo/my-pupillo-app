import { useCallback, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Pupillo: shared form validation helpers.
 *
 * Provides a tiny hook + helpers to give users a consistent experience when
 * a required field is missing on submit:
 *   - red border on the field (via `errorFieldClass`)
 *   - inline message below the field (via `<FieldError>`)
 *   - smooth scroll + focus on the first missing field
 *
 * The hook is intentionally framework-agnostic (no react-hook-form) so it
 * can be sprinkled into existing big forms with minimal refactor.
 */

export const errorFieldClass =
  "border-destructive ring-1 ring-destructive/40 focus-visible:ring-destructive/60 focus-visible:border-destructive";

/** Apply this on a wrapping <div> when the field is built from multiple sub-inputs. */
export const errorBoxClass =
  "rounded-md ring-1 ring-destructive/50 outline outline-1 outline-destructive";

/** Standard short message — alle UI senza copy specifica. */
export const REQUIRED_FIELD_MESSAGE = "Campo obbligatorio";
/** Toast riassuntivo dopo un submit con campi mancanti. */
export const FILL_REQUIRED_TOAST = "Completa i campi evidenziati";

/** Scroll smooth + focus al primo elemento corrispondente a un campo. */
export function scrollToField(name: string) {
  if (typeof document === "undefined") return;
  // Allow callers to register via [data-field="name"] OR by id.
  const el =
    (document.querySelector(`[data-field="${CSS.escape(name)}"]`) as HTMLElement | null) ||
    document.getElementById(name);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  requestAnimationFrame(() => {
    const focusTarget =
      (el.matches("input, select, textarea, button")
        ? (el as HTMLElement)
        : (el.querySelector(
            "input, select, textarea, button",
          ) as HTMLElement | null)) ?? null;
    focusTarget?.focus?.({ preventScroll: true });
  });
}

export function useFieldErrors<K extends string = string>() {
  const [errors, setErrorsState] = useState<Partial<Record<K, string>>>({});
  const orderRef = useRef<K[]>([]);

  const setErrors = useCallback(
    (errs: Partial<Record<K, string>>, order?: K[]) => {
      setErrorsState(errs);
      if (order) orderRef.current = order;
    },
    [],
  );

  const clearError = useCallback((name: K) => {
    setErrorsState((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setErrorsState({}), []);

  /** Scroll + focus the first field that has an error, respecting `order`. */
  const focusFirst = useCallback(
    (order?: K[]) => {
      const list = order ?? orderRef.current;
      const first = list.find((k) => errors[k]);
      if (first) scrollToField(first as string);
    },
    [errors],
  );

  /** Helper to spread on inputs: gives data-field + aria-invalid + className. */
  const fieldProps = useCallback(
    (name: K, extraClass?: string) => ({
      "data-field": name as string,
      "aria-invalid": !!errors[name],
      className: cn(extraClass, errors[name] && errorFieldClass),
      onBlur: () => {
        /* noop: callers wire `clearError` in their onChange */
      },
    }),
    [errors],
  );

  return { errors, setErrors, clearError, clearAll, focusFirst, fieldProps };
}

export function FieldError({
  message,
  className,
}: {
  message?: string | null;
  className?: string;
}) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className={cn(
        "mt-1 flex items-center gap-1 text-xs font-medium text-destructive",
        className,
      )}
    >
      <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{message}</span>
    </p>
  );
}

/**
 * Gate per azioni operative: se il profilo non è completo, avvisa l'utente
 * e lo reindirizza all'onboarding. Ritorna `true` se può procedere.
 *
 * Uso:
 *   if (!ensureProfileComplete(profile, nav)) return;
 */
export function ensureProfileComplete(
  profile: { profile_completed?: boolean | null } | null | undefined,
  navigate: (opts: { to: string }) => void,
  options?: {
    toast?: (msg: string) => void;
    message?: string;
    onboardingPath?: string;
  },
): boolean {
  if (profile?.profile_completed) return true;
  const msg =
    options?.message ??
    "Completa il tuo profilo per continuare. Ti portiamo ai dati mancanti.";
  options?.toast?.(msg);
  navigate({ to: options?.onboardingPath ?? "/onboarding" });
  return false;
}