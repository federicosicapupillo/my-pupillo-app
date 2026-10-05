/**
 * Guardia di sicurezza: il codice client (browser) non deve scrivere sulla
 * tabella `profiles` né leggerla con "tutte le colonne" o leggere
 * `whatsapp_connected`. Il ruolo `authenticated` ha solo SELECT su colonne
 * specifiche e nessun INSERT/UPDATE/DELETE: questi pattern fallirebbero con
 * "permission denied for table profiles".
 *
 * Esclusi: *.server.ts, *.functions.ts (server function), route server sotto
 * src/routes/api, cartelle di test, tipi generati, e catene su `supabaseAdmin`.
 * Permesse: select con elenco esplicito di colonne, e `select("*", { count, head: true })`.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(__dirname, "../..");

function listFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "__tests__" || name === "node_modules") continue;
      listFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function isExcluded(file: string): boolean {
  const rel = path.relative(SRC, file).split(path.sep).join("/");
  return (
    /\.server\.ts$/.test(rel) ||
    /\.functions\.ts$/.test(rel) ||
    /\.(test|spec)\.tsx?$/.test(rel) ||
    rel.startsWith("routes/api/") ||
    rel === "integrations/supabase/types.ts" ||
    rel === "routeTree.gen.ts"
  );
}

type Finding = { file: string; line: number; reason: string };

export function scanSource(rel: string, src: string): Finding[] {
  const findings: Finding[] = [];
  const re = /\.from\(\s*["'`]profiles["'`]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const before = src.slice(Math.max(0, m.index - 80), m.index);
    if (/supabaseAdmin[\s\S]*$/.test(before) && !/;\s*[^;]*$/.test(before.split("supabaseAdmin").pop() ?? "")) {
      continue; // accesso privilegiato lato server
    }
    // Catena fino al primo ";" o max 800 caratteri
    const rest = src.slice(m.index, m.index + 800);
    const end = rest.indexOf(";");
    const chain = end >= 0 ? rest.slice(0, end) : rest;
    const line = src.slice(0, m.index).split("\n").length;
    const push = (reason: string) => findings.push({ file: rel, line, reason });

    const write = chain.match(/\.(update|insert|upsert|delete)\s*\(/);
    if (write) push(`scrittura .${write[1]}( su profiles dal client`);

    const sel = chain.match(/\.select\s*\(([\s\S]*?)\)/);
    if (sel) {
      const args = sel[1].trim();
      const headCount = /head\s*:\s*true/.test(args);
      if (args === "" || /^["'`]\s*\*\s*["'`]/.test(args)) {
        if (!headCount) push("select di tutte le colonne su profiles dal client");
      }
      if (/whatsapp_connected/.test(args)) push("select di whatsapp_connected dal client");
    }
  }
  return findings;
}

describe("accesso client alla tabella profiles", () => {
  it("il riconoscitore individua i pattern vietati", () => {
    const bad = [
      `supabase.from("profiles").update({ a: 1 }).eq("id", x);`,
      `supabase.from('profiles').insert({});`,
      `supabase.from("profiles").upsert({});`,
      `supabase.from("profiles").delete().eq("id", x);`,
      `supabase.from("profiles").select("*").eq("id", x);`,
      `supabase.from("profiles").select().eq("id", x);`,
      `supabase.from("profiles").select("id, whatsapp_connected");`,
    ];
    for (const s of bad) expect(scanSource("x.tsx", s).length, s).toBeGreaterThan(0);

    const ok = [
      `supabase.from("profiles").select("id,full_name").eq("id", x);`,
      `supabase.from("profiles").select("*", { count: "exact", head: true });`,
      `await supabaseAdmin.from("profiles").update({ a: 1 }).eq("id", x);`,
      `await supabaseAdmin\n  .from("profiles")\n  .update({ a: 1 });`,
    ];
    for (const s of ok) expect(scanSource("x.tsx", s), s).toEqual([]);
  });

  it("nessun file client usa pattern vietati su profiles", () => {
    const findings = listFiles(SRC)
      .filter((f) => !isExcluded(f))
      .flatMap((f) => scanSource(path.relative(SRC, f), readFileSync(f, "utf8")));
    expect(findings, JSON.stringify(findings, null, 2)).toEqual([]);
  });
});
