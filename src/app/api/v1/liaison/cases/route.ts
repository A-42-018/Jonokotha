import { run } from "@/lib/api";
import { liaisonCases } from "@/lib/liaison";

// GET: cases referred to the caller's agency (agency liaison only). No reporter, no internal notes.
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/liaison/cases", auth: "required", limit: { user: 30, ip: 60 } }, liaisonCases); }
