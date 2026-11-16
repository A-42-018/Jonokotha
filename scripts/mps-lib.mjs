// Shared by check-mps.mjs and import-mps.mjs. Pure functions, no network.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const MPS_FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../supabase/seed/data/mps-13th-2026-11-16.json");
export const loadMps = (file) => JSON.parse(readFileSync(file ?? MPS_FILE, "utf8"));
const BN = /[ঀ-৿]/;
const KEY = /^bd-\d{3}$/;

/** Returns a list of problems; empty means the file is fit to import. */
export function validateMps(doc) {
  const e = [];
  const seats = doc.seats ?? [];
  if (seats.length !== 300) e.push(`expected 300 seats, found ${seats.length}`);
  for (const f of ["name", "url", "license", "fetched_at"]) if (!doc.source?.[f]) e.push(`source.${f} is missing`);
  const nos = new Set(), keys = new Set(), names = new Set();
  let vacant = 0;
  for (const s of seats) {
    const t = `seat ${s.seat_no}`;
    if (!Number.isInteger(s.seat_no) || s.seat_no < 1 || s.seat_no > 300) e.push(`${t}: seat_no out of range`);
    if (nos.has(s.seat_no)) e.push(`${t}: duplicate seat_no`); nos.add(s.seat_no);
    if (!KEY.test(s.key) || s.key !== `bd-${String(s.seat_no).padStart(3, "0")}`) e.push(`${t}: key ${s.key} does not match seat_no`);
    if (keys.has(s.key)) e.push(`${t}: duplicate key`); keys.add(s.key);
    if (names.has(s.name_en)) e.push(`${t}: duplicate English name ${s.name_en}`); names.add(s.name_en);
    if (!s.name_en || !BN.test(s.name_bn ?? "")) e.push(`${t}: needs an English name and a Bangla name`);
    if (!s.division_en || !BN.test(s.division_bn ?? "") || !s.district_en || !BN.test(s.district_bn ?? "")) e.push(`${t}: division/district names missing`);
    if (s.status === "vacant") { vacant++; if (s.mp) e.push(`${t}: vacant seat has an MP`); }
    else if (s.status === "serving") {
      const m = s.mp;
      if (!m) { e.push(`${t}: serving seat has no MP`); continue; }
      if (!m.name_en?.trim() || !BN.test(m.name_bn ?? "")) e.push(`${t}: MP needs an English and a Bangla name`);
      if (!m.party_en || !BN.test(m.party_bn ?? "")) e.push(`${t}: MP needs a party in English and Bangla`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(m.elected_on ?? "")) e.push(`${t}: elected_on must be YYYY-MM-DD`);
      if (!/^https?:\/\//.test(m.profile_url ?? "")) e.push(`${t}: profile_url missing`);
    } else e.push(`${t}: status must be serving or vacant`);
  }
  for (let i = 1; i <= 300; i++) if (!nos.has(i)) e.push(`seat ${i} is missing`);
  if (vacant !== 1) e.push(`expected exactly 1 vacant seat, found ${vacant}`);
  return e;
}

/** Items in the shape import_representatives expects, in chunks of at most 100. */
export const toChunks = (doc, size = 100) => {
  const out = [];
  for (let i = 0; i < doc.seats.length; i += size) out.push(doc.seats.slice(i, i + size));
  return out;
};
