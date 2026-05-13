import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * DB-trigger integration test for `enforce_worker_personal_data`.
 *
 * Runs the SQL script in `supabase/tests/document_dates_trigger.sql`
 * against the database identified by the standard `PG*` env vars
 * (PGHOST/PGUSER/PGPASSWORD/PGDATABASE/PGPORT). The script wraps
 * everything in BEGIN/ROLLBACK so it is non-destructive.
 *
 * Skipped automatically when no DB credentials or `psql` are available
 * (e.g. on a developer machine without sandbox DB access). To run it,
 * enable "Read database" / "Add data" in Lovable Cloud settings or set
 * PGHOST manually, then execute `bunx vitest run`.
 */

const sqlPath = resolve(
  process.cwd(),
  "supabase/tests/document_dates_trigger.sql",
);

function hasPsql(): boolean {
  try {
    execSync("psql --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const canRun =
  !!process.env.PGHOST && existsSync(sqlPath) && hasPsql();

(canRun ? describe : describe.skip)(
  "DB trigger: enforce_worker_personal_data (date rules)",
  () => {
    it("raises the three Italian error messages exactly", () => {
      // The SQL script raises an exception (non-zero exit) on assertion failure.
      const out = execSync(
        `psql -v ON_ERROR_STOP=1 -X -q -f ${JSON.stringify(sqlPath)}`,
        { stdio: ["ignore", "pipe", "pipe"] },
      ).toString();
      expect(out).toMatch(/OK: enforce_worker_personal_data date rules verified/);
    });
  },
);