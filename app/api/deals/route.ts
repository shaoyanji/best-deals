import { getDealFeed } from "@/lib/feed";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json(await getDealFeed(), {
    headers: { "Cache-Control": "no-store" },
  });
}
