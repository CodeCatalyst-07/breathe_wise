import { AppError } from "@/lib/errors";
import { getContainer } from "@/server/container";
import { AskRequestBodySchema, withApi } from "@/server/http";

export const runtime = "nodejs";

export const POST = withApi(
  {
    route: "/api/ask",
    allowedMethods: ["POST"],
    rateLimitType: "ask",
    bodySchema: AskRequestBodySchema,
    maxBodyBytes: 16384,
  },
  async (_req, ctx) => {
    const container = getContainer();
    const result = await container.pipeline.answerQuestion({
      profile: ctx.body.profile,
      question: ctx.body.question,
      priorTurns: ctx.body.history?.map((h) => ({ role: h.role, text: h.text })),
      requestId: ctx.requestId,
    });

    if (!result.ok) {
      if (result.error.code === "assistant_unavailable") {
        throw new AppError({
          message: result.error.message,
          code: "assistant_unavailable",
          userMessage:
            "The AI assistant is currently unavailable. Please consult the built-in exposure recommendations.",
          httpStatus: 503,
        });
      }

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
