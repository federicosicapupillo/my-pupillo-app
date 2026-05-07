// Single source of truth for credit packs and plans
export const CREDIT_PACKS: Record<string, { credits: number; label: string; priceEur: number }> = {
  credits_10_once: { credits: 10, label: "10 Crediti", priceEur: 9.9 },
  credits_50_once: { credits: 50, label: "50 Crediti", priceEur: 44.9 },
  credits_200_once: { credits: 200, label: "200 Crediti", priceEur: 159 },
};

export const PLAN_PRICES: Record<string, { plan: "pro" | "business"; label: string; priceEur: number }> = {
  pro_monthly: { plan: "pro", label: "Piano Pro", priceEur: 29 },
  business_monthly: { plan: "business", label: "Piano Business", priceEur: 79 },
};

// Credit costs for restaurant actions
export const CREDIT_COSTS = {
  publishAnnouncement: 1,
  publishUrgentAnnouncement: 3,
  assignWorker: 2,
} as const;