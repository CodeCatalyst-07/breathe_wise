import { withApi } from "@/server/http";

export const runtime = "nodejs";

/**
 * Health check endpoint.
 * Deliberately returns no environment variables or internal system topology.
 */
export const GET = withApi(
  {
    route: "/api/health",
    allowedMethods: ["GET"],
    rateLimitType: "health",
  },
  async () => {
    return { status: "ok" };
  },
);
