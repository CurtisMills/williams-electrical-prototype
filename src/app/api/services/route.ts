import { listServices } from "@/lib/db";

export async function GET() {
  return Response.json(await listServices());
}
