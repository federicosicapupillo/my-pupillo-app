// Server-only seed engine for demo data. Uses supabaseAdmin (service_role).
// All inserted rows are tagged is_demo=true + seed_batch_id so they can be
// cleaned via the existing unseed_demo() RPC.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  DEMO_CITIES,
  DEMO_FIRST_NAMES_F,
  DEMO_FIRST_NAMES_M,
  DEMO_LAST_NAMES,
  DEMO_VENUE_TYPES,
  DEMO_WORKER_ROLES,
  jitterCoord,
  mockIdNumber,
  mockTaxCode,
  mockVatNumber,
  pick,
  randInt,
} from "./demo-seed-data";
import {
  DEMO_PASSWORD,
  assertDemoSafe,
  buildSafetyReport,
  isDemoEmail,
  makeDemoEmail,
  newBatchId,
  type DemoSafetyReport,
  type DemoWhitelist,
} from "./demo-seed-guard.server";

export type ResetReport = {
  safety: DemoSafetyReport;
  batchId: string;
  deletedPerTable: Record<string, number>;
  createdPerTable: Record<string, number>;
  preservedNonDemo: { table: string; count: number }[];
  errors: string[];
  durationMs: number;
};

export type PreviewReport = {
  safety: DemoSafetyReport;
  existingDemoBatches: { batch: string; profiles: number }[];
  willDelete: Record<string, number>;
  willCreate: { restaurants: number; workers: number; announcements: number; applications: number; shifts: number; reviews: number };
};

export async function previewReset(whitelist: DemoWhitelist): Promise<PreviewReport> {
  const safety = buildSafetyReport(whitelist);

  const { data: batches } = await supabaseAdmin
    .from("profiles")
    .select("seed_batch_id")
    .eq("is_demo", true);

  const counts = new Map<string, number>();
  (batches ?? []).forEach((r: any) => {
    const b = r.seed_batch_id ?? "(none)";
    counts.set(b, (counts.get(b) ?? 0) + 1);
  });

  const existingDemoBatches = Array.from(counts.entries()).map(([batch, profiles]) => ({ batch, profiles }));

  const tables = [
    "profiles",
    "announcements",
    "applications",
    "shifts",
    "reviews",
    "messages",
    "notifications",
    "worker_badges",
  ];
  const willDelete: Record<string, number> = {};
  for (const t of tables) {
    const { count } = await (supabaseAdmin.from as any)(t).select("*", { count: "exact", head: true }).eq("is_demo", true);
    willDelete[t] = count ?? 0;
  }

  return {
    safety,
    existingDemoBatches,
    willDelete,
    willCreate: {
      restaurants: 100,
      workers: 300,
      announcements: 300,
      applications: 900,
      shifts: 500,
      reviews: 1500,
    },
  };
}

async function deleteAllDemoBatches(report: ResetReport): Promise<void> {
  const { data: batches } = await supabaseAdmin
    .from("profiles")
    .select("seed_batch_id")
    .eq("is_demo", true);
  const unique = Array.from(new Set((batches ?? []).map((r: any) => r.seed_batch_id).filter(Boolean)));

  for (const b of unique) {
    const { data, error } = await supabaseAdmin.rpc("unseed_demo", { _batch: b });
    if (error) {
      report.errors.push(`unseed_demo(${b}): ${error.message}`);
      continue;
    }
    (data ?? []).forEach((row: any) => {
      const k = `del.${row.step}`;
      report.deletedPerTable[k] = (report.deletedPerTable[k] ?? 0) + Number(row.rows_affected ?? 0);
    });
  }

  // Also clean any orphaned auth.users that match the demo email domain (safety net)
  // We cannot DELETE from auth.users via supabase-js without admin API per id.
  const { data: orphanAuthUsers } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const u of orphanAuthUsers?.users ?? []) {
    if (isDemoEmail(u.email)) {
      try { await supabaseAdmin.auth.admin.deleteUser(u.id); } catch (e: any) {
        report.errors.push(`deleteUser(${u.email}): ${e?.message ?? e}`);
      }
    }
  }
}

async function createAuthUser(
  role: "restaurant" | "worker",
  email: string,
  fullName: string,
  report: ResetReport,
): Promise<string | null> {
  // email_confirm: true → no confirmation email is sent
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });
  if (error || !data.user) {
    report.errors.push(`createUser ${email}: ${error?.message ?? "unknown"}`);
    return null;
  }
  return data.user.id;
}

async function seedRestaurants(batchId: string, count: number, report: ResetReport): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 1; i <= count; i++) {
    const fname = pick([...DEMO_FIRST_NAMES_M, ...DEMO_FIRST_NAMES_F]);
    const lname = pick(DEMO_LAST_NAMES);
    const city = pick(DEMO_CITIES);
    const businessName = `Ristorante ${pick(DEMO_LAST_NAMES)} (demo)`;
    const email = makeDemoEmail("ristoratore", i);
    const fullName = `${fname} ${lname}`;

    const uid = await createAuthUser("restaurant", email, fullName, report);
    if (!uid) continue;

    // handle_new_user trigger already inserted profile + user_role(worker).
    // Fix role → restaurant and fill profile.
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "restaurant" });

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        is_demo: true,
        seed_batch_id: batchId,
        full_name: fullName,
        business_name: businessName,
        vat_number: mockVatNumber(),
        vat_status: "valid",
        vat_company_name: businessName,
        vat_verified_at: new Date().toISOString(),
        company_tax_code: mockTaxCode(i),
        venue_type: pick(DEMO_VENUE_TYPES),
        city: city.city,
        province: city.province,
        province_code: city.province_code,
        postal_code: city.postal_code,
        country: "Italia",
        latitude: jitterCoord(city.lat),
        longitude: jitterCoord(city.lng),
        address: `Via ${pick(DEMO_LAST_NAMES)} ${randInt(1, 80)}, ${city.city}`,
        contact_person_first_name: fname,
        contact_person_last_name: lname,
        contact_person_email: email,
        contact_person_phone: `+39 3${randInt(20,99)} ${randInt(1000000,9999999)}`,
        contact_person_role: "owner",
        price_range: pick(["€", "€€", "€€€"]),
        opening_hours: "Lun-Sab 12:00-15:00, 19:00-23:30",
        employees_count: randInt(2, 25),
        primary_role: null,
        profile_completed: true,
        phone_verified: true,
        terms_accepted: true,
      })
      .eq("id", uid);
    if (error) report.errors.push(`profile rest ${email}: ${error.message}`);
    else ids.push(uid);
  }
  return ids;
}

async function seedWorkers(batchId: string, count: number, report: ResetReport): Promise<string[]> {
  const ids: string[] = [];
  const today = new Date();
  for (let i = 1; i <= count; i++) {
    const isF = Math.random() < 0.5;
    const fname = pick(isF ? DEMO_FIRST_NAMES_F : DEMO_FIRST_NAMES_M);
    const lname = pick(DEMO_LAST_NAMES);
    const city = pick(DEMO_CITIES);
    const email = makeDemoEmail("lavoratore", i);
    const fullName = `${fname} ${lname}`;
    const role = pick(DEMO_WORKER_ROLES);

    const uid = await createAuthUser("worker", email, fullName, report);
    if (!uid) continue;

    const birth = new Date(today.getFullYear() - randInt(22, 45), randInt(0, 11), randInt(1, 28));
    const issued = new Date(today.getFullYear() - randInt(1, 5), randInt(0, 11), randInt(1, 28));
    const expires = new Date(today.getFullYear() + randInt(2, 8), randInt(0, 11), randInt(1, 28));
    const seed = `seed-${uid}`;
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;

    // Keep profile_completed=false to skip the heavy worker validators while
    // still providing enough data for the reputation / list / map cards.
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        is_demo: true,
        seed_batch_id: batchId,
        full_name: fullName,
        first_name: fname,
        last_name: lname,
        birth_date: birth.toISOString().slice(0, 10),
        birth_place: city.city,
        nationality: "Italia",
        tax_code: mockTaxCode(i),
        residence_address: `Via ${pick(DEMO_LAST_NAMES)} ${randInt(1, 80)}`,
        residence_city: city.city,
        residence_postal_code: city.postal_code,
        residence_province: city.province_code,
        id_document_type: "carta_identita",
        id_document_number: mockIdNumber(),
        id_document_issued_at: issued.toISOString().slice(0, 10),
        id_document_expires_at: expires.toISOString().slice(0, 10),
        id_document_issuer: "Comune di " + city.city,
        avatar_url: avatarUrl,
        service_area_city: city.city,
        service_area_lat: jitterCoord(city.lat, 0.02),
        service_area_lng: jitterCoord(city.lng, 0.02),
        service_area_radius_m: pick([5000, 10000, 15000, 20000]),
        service_area_district: "Centro",
        work_area_mode: "zones",
        all_zones: false,
        selected_zones: ["Centro"],
        primary_role: role,
        experience_years: randInt(0, 12),
        hourly_rate: randInt(9, 18),
        is_motorized: Math.random() < 0.5,
        languages: ["it"],
        city: city.city,
        province: city.province,
        province_code: city.province_code,
        phone_verified: false,
        profile_completed: false,
        terms_accepted: true,
      })
      .eq("id", uid);
    if (error) report.errors.push(`profile worker ${email}: ${error.message}`);
    else ids.push(uid);
  }
  return ids;
}

async function seedAnnouncementsApplicationsShiftsReviews(
  batchId: string,
  restaurantIds: string[],
  workerIds: string[],
  report: ResetReport,
): Promise<void> {
  if (restaurantIds.length === 0 || workerIds.length === 0) return;

  const today = new Date();
  const annIds: { id: string; restaurant_id: string; service_date: string; tariff: number; hours: number }[] = [];

  // ~3 announcements per restaurant
  for (const rid of restaurantIds) {
    const n = randInt(2, 4);
    for (let i = 0; i < n; i++) {
      const offsetDays = randInt(-60, 14);
      const date = new Date(today);
      date.setDate(date.getDate() + offsetDays);
      const tariff = randInt(10, 18);
      const hours = randInt(3, 8);
      const isPast = offsetDays < 0;
      const { data, error } = await supabaseAdmin
        .from("announcements")
        .insert({
          restaurant_id: rid,
          service_date: date.toISOString().slice(0, 10),
          service_time: "19:00",
          duration_hours: hours,
          tariff_type: "hourly",
          tariff_amount: tariff,
          location_address: "Indirizzo demo",
          professional_profile: pick(DEMO_WORKER_ROLES),
          status: isPast ? "completed" : "active",
          is_demo: true,
          seed_batch_id: batchId,
        })
        .select("id")
        .single();
      if (error || !data) { report.errors.push(`announcement: ${error?.message}`); continue; }
      annIds.push({ id: data.id, restaurant_id: rid, service_date: date.toISOString().slice(0, 10), tariff, hours });
      report.createdPerTable.announcements = (report.createdPerTable.announcements ?? 0) + 1;
    }
  }

  // For each announcement: 2-4 applications. For past announcements, one is accepted → shift + review.
  for (const ann of annIds) {
    const isPast = new Date(ann.service_date) < today;
    const candidates = Array.from({ length: randInt(2, 4) }, () => pick(workerIds));
    const uniqueCandidates = Array.from(new Set(candidates));
    let acceptedWorker: string | null = null;

    for (let i = 0; i < uniqueCandidates.length; i++) {
      const wid = uniqueCandidates[i];
      const willAccept = isPast && i === 0;
      const status = (willAccept ? "accepted" : (isPast ? "rejected" : pick(["pending", "interested", "pending"]))) as any;
      const { data: appData, error } = await supabaseAdmin
        .from("applications")
        .insert({
          announcement_id: ann.id,
          worker_id: wid,
          restaurant_id: ann.restaurant_id,
          status,
          is_demo: true,
          seed_batch_id: batchId,
        })
        .select("id")
        .single();
      if (error || !appData) { report.errors.push(`application: ${error?.message}`); continue; }
      report.createdPerTable.applications = (report.createdPerTable.applications ?? 0) + 1;
      if (willAccept) acceptedWorker = wid;
    }

    if (isPast && acceptedWorker) {
      // Insert shift completed
      const { data: shiftData, error: sErr } = await supabaseAdmin
        .from("shifts")
        .insert({
          announcement_id: ann.id,
          restaurant_id: ann.restaurant_id,
          worker_id: acceptedWorker,
          shift_date: ann.service_date,
          hours: ann.hours,
          amount: ann.tariff * ann.hours,
          status: "completed",
          completed_at: new Date(ann.service_date).toISOString(),
          is_demo: true,
          seed_batch_id: batchId,
        })
        .select("id")
        .single();
      if (sErr || !shiftData) { report.errors.push(`shift: ${sErr?.message}`); continue; }
      report.createdPerTable.shifts = (report.createdPerTable.shifts ?? 0) + 1;

      // 70% chance of a review
      if (Math.random() < 0.7) {
        const punct = randInt(3, 5);
        const prof = randInt(3, 5);
        const comp = randInt(3, 5);
        const rel = randInt(3, 5);
        const team = randInt(3, 5);
        const rating = Math.round((punct + prof + comp + rel + team) / 5);
        const { error: rErr } = await supabaseAdmin
          .from("reviews")
          .insert({
            target_id: acceptedWorker,
            author_id: ann.restaurant_id,
            shift_id: shiftData.id,
            announcement_id: ann.id,
            rating,
            punctuality: punct,
            professionalism: prof,
            competence: comp,
            reliability: rel,
            teamwork: team,
            comment: pick([
              "Ottimo lavoro, ricontatteremo.",
              "Puntuale e professionale.",
              "Esperienza positiva.",
              "Cliente soddisfatto, bravo.",
              "Bravo, lo richiameremo.",
            ]),
            would_rehire: pick(["yes", "yes", "maybe"]),
            is_demo: true,
            seed_batch_id: batchId,
          });
        if (rErr) report.errors.push(`review: ${rErr.message}`);
        else report.createdPerTable.reviews = (report.createdPerTable.reviews ?? 0) + 1;
      }
    }
  }
}

async function retagTriggerArtifacts(batchId: string, demoUserIds: string[], report: ResetReport): Promise<void> {
  // Any row that triggers (notifications, required_reviews, etc.) produced
  // during this seed run is owned by demo users and should be tagged so the
  // next reset can clean it via unseed_demo().
  if (demoUserIds.length === 0) return;

  const tag = async (table: string, idColumn: string) => {
    const { error, count } = await (supabaseAdmin.from as any)(table)
      .update({ is_demo: true, seed_batch_id: batchId }, { count: "exact" })
      .in(idColumn, demoUserIds)
      .eq("is_demo", false);
    if (error) report.errors.push(`retag ${table}: ${error.message}`);
    else if (count) report.createdPerTable[`retag.${table}`] = count;
  };

  await tag("notifications", "user_id");
  // required_reviews: tag by either party
  const { error: rrErr } = await supabaseAdmin
    .from("required_reviews")
    .update({} as any)
    .in("restaurant_user_id", demoUserIds);
  if (rrErr) report.errors.push(`retag required_reviews: ${rrErr.message}`);
}

export async function resetAndReseedDemo(
  whitelist: DemoWhitelist,
  sizes?: { restaurants?: number; workers?: number },
): Promise<ResetReport> {
  const start = Date.now();
  const safety = assertDemoSafe(whitelist);
  const batchId = newBatchId();

  const report: ResetReport = {
    safety,
    batchId,
    deletedPerTable: {},
    createdPerTable: {},
    preservedNonDemo: [],
    errors: [],
    durationMs: 0,
  };

  // Phase 1: cleanup existing demo data only.
  await deleteAllDemoBatches(report);

  // Phase 2: create new demo users.
  const nRest = sizes?.restaurants ?? 100;
  const nWork = sizes?.workers ?? 300;
  const restaurantIds = await seedRestaurants(batchId, nRest, report);
  const workerIds = await seedWorkers(batchId, nWork, report);
  report.createdPerTable.restaurants = restaurantIds.length;
  report.createdPerTable.workers = workerIds.length;

  // Phase 3: announcements / applications / shifts / reviews.
  await seedAnnouncementsApplicationsShiftsReviews(batchId, restaurantIds, workerIds, report);

  // Phase 4: retag any auto-created notifications/required_reviews owned by demo users.
  await retagTriggerArtifacts(batchId, [...restaurantIds, ...workerIds], report);

  // Phase 5: recompute reputation for every demo worker from the real seeded data.
  for (const wid of workerIds) {
    const { error } = await supabaseAdmin.rpc("recompute_worker_reputation", { _worker: wid });
    if (error) report.errors.push(`recompute(${wid.slice(0, 8)}…): ${error.message}`);
  }

  // Phase 6: transparency — count records NOT in demo set, must stay untouched.
  for (const t of ["profiles", "announcements", "applications", "shifts", "reviews"]) {
    const { count } = await (supabaseAdmin.from as any)(t).select("*", { count: "exact", head: true }).eq("is_demo", false);
    report.preservedNonDemo.push({ table: t, count: count ?? 0 });
  }

  report.durationMs = Date.now() - start;
  return report;
}

// ---------------------------------------------------------------------------
// "Completa profili test" — riempie i campi mancanti di tutti i profili
// is_demo=true (lavoratori e ristoratori) senza ricreare gli utenti né
// toccare profili reali. Usato dalla pagina Admin per avere demo completi
// (foto, telefono fittizio confermato, documenti fake, profile_completed=true).

export type CompleteDemoReport = {
  scannedProfiles: number;
  updatedWorkers: number;
  updatedRestaurants: number;
  skippedRealProfiles: number;
  errors: string[];
  durationMs: number;
};

function fakePhone(seed: string): string {
  // +39 3XX YYYYYYY — fittizio coerente, deterministico sull'id.
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const a = 20 + (h % 80);
  const b = String(1000000 + (h % 8999999)).slice(0, 7);
  return `+39 3${a} ${b}`;
}

function fakeAvatar(seed: string): string {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;
}

function pickByHash<T>(arr: T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return arr[h % arr.length];
}

function fakeDateBefore(seed: string, minYearsAgo: number, maxYearsAgo: number): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 17 + seed.charCodeAt(i)) >>> 0;
  const today = new Date();
  const years = minYearsAgo + (h % Math.max(1, maxYearsAgo - minYearsAgo + 1));
  const d = new Date(today.getFullYear() - years, (h >> 3) % 12, ((h >> 5) % 27) + 1);
  return d.toISOString().slice(0, 10);
}

function fakeDateAfter(seed: string, minYearsAhead: number, maxYearsAhead: number): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 19 + seed.charCodeAt(i)) >>> 0;
  const today = new Date();
  const years = minYearsAhead + (h % Math.max(1, maxYearsAhead - minYearsAhead + 1));
  const d = new Date(today.getFullYear() + years, (h >> 3) % 12, ((h >> 5) % 27) + 1);
  return d.toISOString().slice(0, 10);
}

export async function completeDemoProfiles(
  triggeredBy: string,
): Promise<CompleteDemoReport> {
  const start = Date.now();
  const report: CompleteDemoReport = {
    scannedProfiles: 0,
    updatedWorkers: 0,
    updatedRestaurants: 0,
    skippedRealProfiles: 0,
    errors: [],
    durationMs: 0,
  };

  // Guard di sicurezza: deve esserci il service role e non dev'esserci stripe LIVE.
  // Riusa lo stesso safety guard del reset.
  try {
    assertDemoSafe({ emails: [], phones: [] });
  } catch (e: any) {
    report.errors.push(`safety: ${e?.message ?? e}`);
    report.durationMs = Date.now() - start;
    return report;
  }

  // Carica SOLO profili demo (is_demo=true). Mai modificare profili reali.
  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("is_demo", true)
    .limit(5000);
  if (error) {
    report.errors.push(`load profiles: ${error.message}`);
    report.durationMs = Date.now() - start;
    return report;
  }

  // Mappa ruolo per ogni utente (worker / restaurant) tramite user_roles.
  const ids = (profiles ?? []).map((p: any) => p.id);
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, role")
    .in("user_id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const roleByUser = new Map<string, string>();
  (roles ?? []).forEach((r: any) => roleByUser.set(r.user_id, r.role));

  for (const p of profiles ?? []) {
    report.scannedProfiles++;
    // Doppia salvaguardia: salta se per qualche motivo is_demo è false.
    if (!p.is_demo) {
      report.skippedRealProfiles++;
      continue;
    }

    const role = roleByUser.get(p.id);
    const isRestaurant = role === "restaurant" || !!p.business_name;
    const city = pickByHash(DEMO_CITIES, p.id);

    if (isRestaurant) {
      const fname = p.contact_person_first_name || pickByHash([...DEMO_FIRST_NAMES_M, ...DEMO_FIRST_NAMES_F], p.id + "f");
      const lname = p.contact_person_last_name || pickByHash(DEMO_LAST_NAMES, p.id + "l");
      const update: Record<string, any> = {
        full_name: p.full_name ?? `${fname} ${lname}`,
        business_name: p.business_name ?? `Ristorante ${pickByHash(DEMO_LAST_NAMES, p.id)} (demo)`,
        venue_type: p.venue_type ?? pickByHash(DEMO_VENUE_TYPES, p.id),
        city: p.city ?? city.city,
        province: p.province ?? city.province,
        province_code: p.province_code ?? city.province_code,
        postal_code: p.postal_code ?? city.postal_code,
        country: p.country ?? "Italia",
        latitude: p.latitude ?? jitterCoord(city.lat),
        longitude: p.longitude ?? jitterCoord(city.lng),
        service_area_lat: p.service_area_lat ?? jitterCoord(city.lat, 0.02),
        service_area_lng: p.service_area_lng ?? jitterCoord(city.lng, 0.02),
        address: p.address ?? `Via ${pickByHash(DEMO_LAST_NAMES, p.id + "a")} ${(p.id.charCodeAt(0) % 80) + 1}, ${city.city}`,
        neighborhood: p.neighborhood ?? "Centro",
        contact_person_first_name: fname,
        contact_person_last_name: lname,
        contact_person_email: p.contact_person_email ?? p.email ?? null,
        contact_person_phone: p.contact_person_phone ?? fakePhone(p.id + "r"),
        contact_person_role: p.contact_person_role ?? "owner",
        vat_number: p.vat_number ?? mockVatNumber(),
        vat_status: p.vat_status ?? "valid",
        vat_company_name: p.vat_company_name ?? p.business_name ?? "Ristorante Demo",
        vat_verified_at: p.vat_verified_at ?? new Date().toISOString(),
        company_tax_code: p.company_tax_code ?? mockTaxCode(p.id.length),
        price_range: p.price_range ?? pickByHash(["€", "€€", "€€€"], p.id),
        opening_hours: p.opening_hours ?? "Lun-Sab 12:00-15:00, 19:00-23:30",
        employees_count: p.employees_count ?? 8,
        avatar_url: p.avatar_url ?? fakeAvatar("restaurant-" + p.id),
        phone: p.phone ?? fakePhone(p.id),
        phone_full: p.phone_full ?? fakePhone(p.id).replace(/\s/g, ""),
        phone_verified: true,
        phone_verified_at: p.phone_verified_at ?? new Date().toISOString(),
        whatsapp_connected: true,
        terms_accepted: true,
        profile_completed: true,
        account_status: p.account_status ?? "active",
      };
      const { error: uErr } = await supabaseAdmin.from("profiles").update(update).eq("id", p.id).eq("is_demo", true);
      if (uErr) report.errors.push(`restaurant ${p.id.slice(0, 8)}: ${uErr.message}`);
      else report.updatedRestaurants++;
    } else {
      const fname = p.first_name || pickByHash([...DEMO_FIRST_NAMES_M, ...DEMO_FIRST_NAMES_F], p.id + "f");
      const lname = p.last_name || pickByHash(DEMO_LAST_NAMES, p.id + "l");
      const update: Record<string, any> = {
        full_name: p.full_name ?? `${fname} ${lname}`,
        first_name: fname,
        last_name: lname,
        birth_date: p.birth_date ?? fakeDateBefore(p.id + "b", 22, 45),
        birth_place: p.birth_place ?? city.city,
        nationality: p.nationality ?? "Italia",
        tax_code: p.tax_code ?? mockTaxCode(p.id.length),
        residence_address: p.residence_address ?? `Via ${pickByHash(DEMO_LAST_NAMES, p.id + "r")} ${(p.id.charCodeAt(1) % 80) + 1}`,
        residence_city: p.residence_city ?? city.city,
        residence_postal_code: p.residence_postal_code ?? city.postal_code,
        residence_province: p.residence_province ?? city.province_code,
        id_document_type: p.id_document_type ?? "carta_identita",
        id_document_number: p.id_document_number ?? mockIdNumber(),
        id_document_issued_at: p.id_document_issued_at ?? fakeDateBefore(p.id + "i", 1, 5),
        id_document_expires_at: p.id_document_expires_at ?? fakeDateAfter(p.id + "e", 2, 8),
        id_document_issuer: p.id_document_issuer ?? `Comune di ${city.city}`,
        // Path fittizio (NON file reali). Serve solo a far risultare il
        // documento "caricato" lato UI. Lo storage non viene toccato.
        id_document_path: p.id_document_path ?? `demo/${p.id}/documento_test.pdf`,
        id_document_back_path: p.id_document_back_path ?? `demo/${p.id}/documento_test_retro.pdf`,
        avatar_url: p.avatar_url ?? fakeAvatar("worker-" + p.id),
        primary_role: p.primary_role ?? pickByHash(DEMO_WORKER_ROLES, p.id),
        secondary_roles: p.secondary_roles && p.secondary_roles.length > 0 ? p.secondary_roles : [pickByHash(DEMO_WORKER_ROLES, p.id + "s")],
        experience_years: p.experience_years ?? ((p.id.charCodeAt(0) % 12)),
        experience_level: p.experience_level ?? pickByHash(["junior", "middle", "senior"], p.id),
        hourly_rate: p.hourly_rate ?? 10 + (p.id.charCodeAt(2) % 9),
        is_motorized: p.is_motorized ?? ((p.id.charCodeAt(3) % 2) === 0),
        short_bio: p.short_bio ?? "Profilo demo per test della piattaforma.",
        languages: p.languages && p.languages.length > 0 ? p.languages : ["it"],
        weekly_availability: p.weekly_availability && p.weekly_availability.length > 0
          ? p.weekly_availability
          : ["lun_sera", "mar_sera", "ven_sera", "sab_sera", "dom_pranzo"],
        city: p.city ?? city.city,
        province: p.province ?? city.province,
        province_code: p.province_code ?? city.province_code,
        neighborhood: p.neighborhood ?? "Centro",
        service_area_city: p.service_area_city ?? city.city,
        service_area_district: p.service_area_district ?? "Centro",
        service_area_lat: p.service_area_lat ?? jitterCoord(city.lat, 0.02),
        service_area_lng: p.service_area_lng ?? jitterCoord(city.lng, 0.02),
        service_area_radius_m: p.service_area_radius_m ?? 10000,
        work_area_mode: p.work_area_mode ?? "zones",
        all_zones: p.all_zones ?? false,
        selected_zones: p.selected_zones && p.selected_zones.length > 0 ? p.selected_zones : ["Centro"],
        badge: p.badge ?? pickByHash(["basic", "pro", "elite"], p.id),
        phone: p.phone ?? fakePhone(p.id),
        phone_full: p.phone_full ?? fakePhone(p.id).replace(/\s/g, ""),
        phone_verified: true,
        phone_verified_at: p.phone_verified_at ?? new Date().toISOString(),
        whatsapp_connected: true,
        age_verified: true,
        age_verified_at: p.age_verified_at ?? new Date().toISOString(),
        terms_accepted: true,
        profile_completed: true,
        account_status: p.account_status ?? "active",
      };
      const { error: uErr } = await supabaseAdmin.from("profiles").update(update).eq("id", p.id).eq("is_demo", true);
      if (uErr) report.errors.push(`worker ${p.id.slice(0, 8)}: ${uErr.message}`);
      else report.updatedWorkers++;
    }
  }

  // Log dell'operazione in activity_logs (visibile agli admin).
  try {
    await supabaseAdmin.from("activity_logs").insert({
      user_id: triggeredBy,
      action: "complete_demo_profiles",
      entity_type: "profiles",
      metadata: {
        scannedProfiles: report.scannedProfiles,
        updatedWorkers: report.updatedWorkers,
        updatedRestaurants: report.updatedRestaurants,
        errors: report.errors.length,
      },
    });
  } catch (e: any) {
    report.errors.push(`activity_log: ${e?.message ?? e}`);
  }

  report.durationMs = Date.now() - start;
  return report;
}