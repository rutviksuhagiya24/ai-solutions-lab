import { trackMetrics, estimateTokens, estimateCostUSD } from "@/lib/mlops-tracking";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

import {
  getBusiness,
  getDocumentsByBusiness,
  createMessage,
} from "@/lib/database";

import {
  generateSessionId,
  getServerRemainingMessages,
  incrementServerMessageCount,
} from "@/lib/rate-limit";

// --- Request payload schema ---
const ChatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
    })
  ),
  businessId: z.string().min(1, "businessId required"),
  conversationId: z.string().optional(),
});

// --- Helper: build a simple KB section from docs ---
function buildKnowledgeBaseSection(
  docs: Array<{ title?: string | null; content?: string | null }>
) {
  if (!docs?.length) return "";
  const trimmed = docs
    .slice(0, 5)
    .map((d, i) => {
      const title = (d.title ?? `Doc ${i + 1}`).trim();
      const content = (d.content ?? "").trim().slice(0, 1500); // keep prompt small
      return `### ${title}\n${content}`;
    })
    .join("\n\n");
  return `\n\n### Business Knowledge Base\n${trimmed}`;
}

export async function POST(req: Request) {
  try {
    // --- Parse & validate body ---
    const json = await req.json();
    const parsed = ChatRequestSchema.safeParse(json);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { messages, businessId, conversationId } = parsed.data;

    // --- Server-side rate limiting ---
    const sessionId = generateSessionId(req);
    const remaining = getServerRemainingMessages(sessionId, businessId);

    if (remaining <= 0) {
      return Response.json(
        {
          error: "Free message limit reached",
          message:
            "You've reached the limit for free messages. Please sign up to continue chatting.",
          type: "rate_limit",
          remainingMessages: 0,
        },
        { status: 429 }
      );
    }

    // --- Get business context ---
    const business = await getBusiness(businessId);
    if (!business) {
      return Response.json({ error: "Business not found" }, { status: 400 });
    }

    // --- Pull documents and build KB ---
    const documents = await getDocumentsByBusiness(businessId);
    const hasDocs = documents && documents.length > 0;
    const kbSection = hasDocs ? buildKnowledgeBaseSection(documents) : "";

    // --- Build prompt (system-style context + latest user message) ---
    const lastUserMsg =
      messages
        .slice()
        .reverse()
        .find((m) => m.role === "user")?.content ?? "";

    const systemContext = [
      `You are an AI receptionist for the business "${business.name}".`,
      business.industry ? `Industry: ${business.industry}` : "",
      business.description ? `About: ${business.description}` : "",
      `Be concise, friendly, and helpful. If an appointment is requested, capture details.`,
      kbSection,
    ]
      .filter(Boolean)
      .join("\n");

    const fullPrompt = [
      `### Instructions\n${systemContext}`,
      `\n### User Message\n${lastUserMsg}`,
      `\n### Your Task\nReply as the AI receptionist in plain text.`,
    ].join("\n");

    // --- Call AI model with timing ---
    const start = Date.now();

    const result = await generateObject({
      model: google("models/gemini-1.5-flash-latest"),
      schema: z.object({ reply: z.string() }),
      prompt: fullPrompt,
    });

    const end = Date.now();
    const reply = result.object.reply ?? "Sorry, I didn’t catch that.";

    // --- Persist assistant message (optional: also persist user message upstream) ---
    try {
      await createMessage({
        conversationId: conversationId ?? undefined,
        businessId,
        role: "assistant",
        content: reply,
      });
    } catch (e) {
      // Don't fail the request if logging the message fails
      console.warn("createMessage failed:", e);
    }

    // --- Increment server-side count for rate limiting ---
    try {
      incrementServerMessageCount(sessionId, businessId);
    } catch (e) {
      console.warn("incrementServerMessageCount failed:", e);
    }

    // --- Track MLOps metrics (Flask service on :5001) ---
    try {
      await trackMetrics({
        business_id: businessId,
        response_time_ms: end - start,
      });
    } catch (e) {
      console.warn("trackMetrics failed:", e);
    }

    // --- Return response ---
    return new Response(
      JSON.stringify({
        reply,
        conversationId,
        remainingMessages: Math.max(remaining - 1, 0),
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Chat API error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
