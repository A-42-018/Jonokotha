import { run } from "@/lib/api";
import { listRepresentatives } from "@/lib/reps-projects";

// GET /representatives?constituency=: verified representatives only.
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/representatives", auth: "optional", limit: { ip: 120 } }, listRepresentatives); }
