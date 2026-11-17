import { run } from "@/lib/api";
import { delegateTask, listTasks } from "@/lib/mp-office";

// GET ?status=&mine=1: tasks you delegated or hold. POST {constituency, assignee, title, detail?, due_date?, issue_ref?}: MP or office manager.
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/office/tasks", auth: "required", limit: { user: 30, ip: 60 } }, listTasks); }
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/office/tasks", auth: "required", limit: { user: 20, ip: 60 }, idempotency: "optional" }, delegateTask); }
