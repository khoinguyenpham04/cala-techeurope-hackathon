import { getOrbitCatalog } from "@/lib/orbit/catalog-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const catalog = await getOrbitCatalog();
  const status = catalog.records.length > 0 ? 200 : 503;
  return Response.json(catalog, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}
