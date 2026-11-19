import { AppError } from "@/lib/errors";
import { getContainer } from "@/server/container";
import { ExplainRequestBodySchema, withApi } from "@/server/http";

export const runtime = "nodejs";

export const POST = withApi(
  {
    route: "/api/explain",
    allowedMethods: ["POST"],
    rateLimitType: "explain",
    bodySchema: ExplainRequestBodySchema,
  },
  async (_req, ctx) => {
    const container = getContainer();
    const result = await container.pipeline.explainAdvice({
      profile: ctx.body.profile,
      requestId: ctx.requestId,
    });

    if (!result.ok) {
      throw new AppError({
        message: result.error.message,
        code: result.error.code,
        userMessage: result.error.message,
        httpStatus: result.error.code === "validation_error" ? 400 : 500,
      });
    }

    return result.value;
  },
);
