import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { WorkerProfilePreviewDialog } from "@/components/WorkerProfilePreviewDialog";

/**
 * Unified worker-profile modal for the restaurant side. Wrap a page with
 * <WorkerProfileModalProvider source="..."> and call
 * useOpenWorkerProfile() from any descendant to open the same shared
 * popup — no navigation, no 404, restaurant stays on the page.
 */

type OpenArgs = {
  workerId: string;
  workerName?: string | null;
  trigger?: "card_button" | "avatar_button" | "marker_button" | "candidate_button";
};

type Ctx = (args: OpenArgs) => void;

const WorkerProfileModalContext = createContext<Ctx | null>(null);

export function useOpenWorkerProfile(): Ctx {
  const ctx = useContext(WorkerProfileModalContext);
  if (!ctx) {
    // Safe no-op fallback so a missing provider never crashes the page.
    return () => {
      if (typeof console !== "undefined") {
        console.warn("[PUPILLO_WORKER_PROFILE_MODAL_OPEN_DEBUG] No provider mounted; call ignored");
      }
    };
  }
  return ctx;
}

export function WorkerProfileModalProvider({ source, children }: { source: string; children: ReactNode }) {
  const [workerId, setWorkerId] = useState<string | null>(null);

  const open = useCallback<Ctx>((args) => {
    if (!args?.workerId) return;
    if (typeof console !== "undefined") {
      console.log("[PUPILLO_WORKER_PROFILE_MODAL_OPEN_DEBUG]", {
        pagina_origine: source,
        trigger: args.trigger ?? "card_button",
        worker_user_id: args.workerId,
        profile_id: args.workerId,
        nome_lavoratore: args.workerName ?? null,
        popup_aperto: true,
      });
    }
    setWorkerId(args.workerId);
  }, [source]);

  const value = useMemo(() => open, [open]);

  return (
    <WorkerProfileModalContext.Provider value={value}>
      {children}
      <WorkerProfilePreviewDialog
        workerId={workerId}
        open={workerId !== null}
        onOpenChange={(o) => { if (!o) setWorkerId(null); }}
        source={source}
      />
    </WorkerProfileModalContext.Provider>
  );
}