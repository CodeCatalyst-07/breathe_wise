import { ValidationError } from "@/lib/errors";
import { getContainer } from "@/server/container";
import { GeocodeQuerySchema, withApi } from "@/server/http";

export const runtime = "nodejs";

export const GET = withApi(
  {
    route: "/api/geocode",
    allowedMethods: ["GET"],
    rateLimitType: "geocode",
  },
  async (req) => {
    const url = new URL(req.url);
    const rawQuery = {
      q: url.searchParams.get("q") ?? "",
      lang: url.searchParams.get("lang") ?? undefined,
    };

    const parse = GeocodeQuerySchema.safeParse(rawQuery);
    if (!parse.success) {
      throw new ValidationError({
        message: "Invalid geocode query parameters",
        userMessage: "Search query 'q' must be between 2 and 100 characters long.",
        details: parse.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }

    const container = getContainer();
    const result = await container.geocoding.searchLocation(parse.data.q);
    const candidates = result.ok ? result.value.slice(0, 5) : [];

    return {
      candidates: candidates.map((c) => ({
        label: c.label,
        lat: c.lat,
        lng: c.lng,
        timezone: c.timezone,
      })),
    };
  },
);
