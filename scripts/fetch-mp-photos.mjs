// npm run fetch:mp-photos [-- --dry] [--seat 12] [--delay 2000]
// For each serving MP: opens the official profile page, takes the photo whose caption matches the MP's name, copies it into the
// public `rep-photos` bucket and records photo_path / photo_source_url / photo_checked_at. Mismatches get NO photo and are listed
// in supabase/seed/data/mp-photo-report.json for a person to check. --dry downloads and checks but writes nothing.
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server only) unless --dry.
import { writeFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { loadMps } from "./mps-lib.mjs";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i < 0 ? d : (process.argv[i + 1]?.startsWith("--") || i + 1 >= process.argv.length ? true : process.argv[i + 1]); };
const dry = arg("dry", false) === true, only = arg("seat", null), delay = Number(arg("delay", 2000)), today = new Date().toISOString().slice(0, 10);
const UA = "Mozilla/5.0 (compatible; JonokothaBot/1.0; civic-info)";
// parliament.gov.bd sends an incomplete certificate chain, which Node 22.12 rejects; curl completes it from the system store.
// TLS verification stays ON (never use NODE_TLS_REJECT_UNAUTHORIZED=0). Requires curl.
const run = promisify(execFile);
const get = async (url) => (await run("curl", ["-sSL", "--fail", "-m", "30", "-A", UA, url], { encoding: "buffer", maxBuffer: 8 * 1024 * 1024 })).stdout;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TITLES = new Set(["md", "mohammad", "muhammad", "mohammed", "mohd", "dr", "adv", "advocate", "barrister", "engr", "engineer", "prof", "professor", "maj", "col", "lt", "gen", "retd", "alhaj", "haji", "mufti", "maulana", "mawlana", "sheikh", "syed", "sayed", "begum", "mrs", "ms", "mr", "al", "abu"]);
const tokens = (s) => new Set(s.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter((t) => t && !TITLES.has(t)));
export function sameName(a, b) {
  const A = tokens(a), B = tokens(b); if (!A.size || !B.size) return false;
  const inter = [...A].filter((t) => B.has(t)).length;
  return inter >= 2 && inter / Math.min(A.size, B.size) >= 0.67 || (inter >= 1 && A.size === 1 && B.size === 1);
}

const sb = !dry && createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
if (!dry && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) { console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or use --dry."); process.exit(1); }

const sniff = (b) => b[0] === 0xff && b[1] === 0xd8 ? ["image/jpeg", "jpg"] : b.subarray(0, 4).toString("hex") === "89504e47" ? ["image/png", "png"] : b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" ? ["image/webp", "webp"] : null;

const seats = loadMps().seats.filter((s) => s.mp && (!only || String(s.seat_no) === String(only)));
const report = { checked_at: today, dry, ok: [], no_photo: [], name_mismatch: [], errors: [] };
for (const [i, s] of seats.entries()) {
  const tag = `${s.seat_no} ${s.name_en}`;
  try {
    const html = (await get(s.mp.profile_url)).toString("utf8");
    const found = [...html.matchAll(/<img src="(https:\/\/prp\.parliament\.gov\.bd\/api\/files\?_=[^"]+)" alt="([^"]*)"/g)].map((m) => ({ url: m[1].replace(/&amp;/g, "&"), alt: m[2] }));
    if (!found.length) { report.no_photo.push({ seat: s.seat_no, name: s.name_en }); console.log(`- ${tag}: no photo on the page`); }
    else {
      const hit = found.find((f) => sameName(f.alt, s.mp.name_en));
      if (!hit) { report.name_mismatch.push({ seat: s.seat_no, name: s.name_en, page_names: found.map((f) => f.alt) }); console.log(`! ${tag}: page shows ${found.map((f) => f.alt).join(" / ")}`); }
      else {
        const buf = await get(hit.url);
        const kind = sniff(buf);
        if (!kind || buf.length > 1_048_576 || buf.length < 1000) throw new Error(`not a usable image (${buf.length} bytes)`);
        const path = `${s.key}.${kind[1]}`;
        if (!dry) {
          const up = await sb.storage.from("rep-photos").upload(path, buf, { contentType: kind[0], upsert: true, cacheControl: "86400" });
          if (up.error) throw new Error(`upload: ${up.error.message}`);
          const { data: rc, error: e1 } = await sb.from("representative_constituencies").select("representative_id, constituencies!inner(seat_no)").eq("constituencies.seat_no", s.seat_no).is("valid_to", null).maybeSingle();
          if (e1 || !rc) throw new Error(`no current MP in the database for this seat (${e1?.message ?? "run import:mps first"})`);
          const { error: e2 } = await sb.from("representatives").update({ photo_path: path, photo_source_url: s.mp.profile_url, photo_checked_at: today }).eq("id", rc.representative_id);
          if (e2) throw new Error(`update: ${e2.message}`);
        }
        report.ok.push({ seat: s.seat_no, name: s.name_en, path, bytes: buf.length }); console.log(`+ ${tag}: ${path} ${buf.length}B`);
      }
    }
  } catch (e) { report.errors.push({ seat: s.seat_no, name: s.name_en, error: String(e.message ?? e) }); console.log(`x ${tag}: ${e.message ?? e}`); }
  if (i < seats.length - 1) await sleep(delay);
}
console.log(`\nok ${report.ok.length}, no photo ${report.no_photo.length}, name mismatch ${report.name_mismatch.length}, errors ${report.errors.length}`);
if (!only) writeFileSync(new URL("../supabase/seed/data/mp-photo-report.json", import.meta.url), JSON.stringify(report, null, 1));
