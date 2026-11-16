import { run } from "@/lib/api";
import { listProjects } from "@/lib/reps-projects";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/projects", auth: "optional", limit: { ip: 120 } }, listProjects); }
