import "server-only";
import { AppError } from "@/lib/we/store";

export async function handle<T>(fn: () => Promise<T>, successStatus = 200): Promise<Response> {
  try {
    return Response.json(await fn(), { status: successStatus });
  } catch (err) {
    if (err instanceof AppError) return Response.json({ error: err.message }, { status: err.status });
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null);
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}
