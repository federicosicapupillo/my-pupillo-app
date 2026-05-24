import { completeDemoProfiles } from "@/lib/demo-seed.server";
// Monkeypatch isn't needed — we need to fix the source's "middle" mapping.
// Just re-run; the function re-updates fields and our enum fix lets it pass.
const r = await completeDemoProfiles("00000000-0000-0000-0000-000000000000");
console.log({ updatedWorkers: r.updatedWorkers, updatedRestaurants: r.updatedRestaurants, errors: r.errors.length });
if (r.errors.length) console.log("samples:", r.errors.slice(0, 5));
