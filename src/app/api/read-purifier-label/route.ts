import { withApi } from "@/server/http";
import { processPurifierLabel, ReadPurifierLabelRequestSchema } from "@/server/purifier-reader";

export const runtime = "nodejs";

export const POST = withApi(
  {
    route: "/api/read-purifier-label",
    allowedMethods: ["POST"],
    rateLimitType: "ask",
    bodySchema: ReadPurifierLabelRequestSchema,
  },
  async (_req, ctx) => {
    return processPurifierLabel(ctx.body);
  },
);
