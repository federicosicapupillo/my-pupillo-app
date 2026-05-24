import { resetAndReseedDemo, completeDemoProfiles } from "@/lib/demo-seed.server";

const t0 = Date.now();
console.log("Starting seed: 300 workers + 100 restaurants...");
const seed = await resetAndReseedDemo({ emails: [], phones: [] }, { restaurants: 100, workers: 300 });
console.log("Seed done in", ((Date.now() - t0) / 1000).toFixed(1), "s");
console.log("batchId:", seed.batchId);
console.log("createdPerTable:", seed.createdPerTable);
console.log("errors:", seed.errors.length);
if (seed.errors.length) console.log("first errors:", seed.errors.slice(0, 5));

console.log("Completing demo profiles...");
const complete = await completeDemoProfiles("00000000-0000-0000-0000-000000000000");
console.log("complete:", { updatedWorkers: complete.updatedWorkers, updatedRestaurants: complete.updatedRestaurants, errors: complete.errors.length });
if (complete.errors.length) console.log("first complete errors:", complete.errors.slice(0, 5));

console.log("TOTAL time:", ((Date.now() - t0) / 1000).toFixed(1), "s");
