import { createQuoteRequest, validateQuoteRequest } from "@/lib/db";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = validateQuoteRequest(body);
  if (!result.ok) return Response.json({ errors: result.errors }, { status: 400 });

  const job = await createQuoteRequest(result.data);
  return Response.json(job, { status: 201 });
}
