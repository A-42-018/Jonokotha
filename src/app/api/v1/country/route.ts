import { run } from "@/lib/api";
import { getCountry, setCountry } from "@/lib/country-routes";

// GET: the active country adapter (locale, currency, date format, administrative levels, channels, emergency numbers). Public. POST {code, config, activate?}: admin; audited.
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/country", auth: "optional", limit: { ip: 120 } }, getCountry); }
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/country", auth: "required", limit: { user: 5, ip: 20 } }, setCountry); }
