import { AppError } from "@/lib/errors";
import { getContainer } from "@/server/container";
import { ParseProfileRequestBodySchema, withApi } from "@/server/http";
import { buildDraftProfileFromExtracted } from "@/server/profile-draft";

export const runtime = "nodejs";

export const POST = withApi(
  {
    route: "/api/parse-profile",
    allowedMethods: ["POST"],
    rateLimitType: "parse-profile",
    bodySchema: ParseProfileRequestBodySchema,
  },
  async (_req, ctx) => {
    const container = getContainer();

    if (!container.llm?.parseProfile) {
      throw new AppError({
        message: "Profile parsing LLM service is not configured or unavailable",
        code: "assistant_unavailable",
        userMessage:
          "Automated profile parsing is currently unavailable. Please enter your profile manually.",
        httpStatus: 503,
      });
    }

    const parseRes = await container.llm.parseProfile(ctx.body.text, ctx.body.language);
    if (!parseRes.ok) {
      throw new AppError({
        message: parseRes.error.message,
        code: "assistant_unavailable",
        userMessage: "Failed to extract household profile from the provided text.",
        httpStatus: 503,
      });
    }

    return buildDraftProfileFromExtracted(
      parseRes.value as Record<string, unknown>,
      ctx.body.language,
    );
  },
);
