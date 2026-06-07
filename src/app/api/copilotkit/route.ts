import { NextRequest } from "next/server";
import {
  CopilotRuntime,
  GoogleGenerativeAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";

export const runtime = "nodejs";

const copilotRuntime = new CopilotRuntime();

export const POST = async (req: NextRequest) => {
  const geminiApiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GOOGLE_API_KEY;

  if (!geminiApiKey) {
    return Response.json(
      {
        error: "Missing Gemini API key",
        details:
          "Set GEMINI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or GOOGLE_API_KEY in .env.local and Vercel Environment Variables.",
      },
      { status: 500 }
    );
  }

  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime: copilotRuntime,
    serviceAdapter: new GoogleGenerativeAIAdapter({
      model: "gemini-2.0-flash",
      apiKey: geminiApiKey,
    }),
    endpoint: req.nextUrl.pathname,
  });

  return handleRequest(req);
};
