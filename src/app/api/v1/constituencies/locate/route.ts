import { run } from "@/lib/api";
import { locateSeat } from "@/lib/seat-locate";

// GET ?lat=&lng=: the seat that holds this point (exact verified boundary), or the district's seats to choose from. The point is not stored.
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/constituencies/locate", auth: "optional", limit: { ip: 60 } }, locateSeat); }
