import { run } from "@/lib/api";
import { ttsConfig, speak } from "@/lib/tts";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/ai/speak", auth: "optional", limit: { ip: 120 } }, ttsConfig); }
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/ai/speak", auth: "required", limit: { user: 10, ip: 30 }, feature: "read_aloud" }, speak); }
