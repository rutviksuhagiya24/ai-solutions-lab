// lib/mlops-tracking.ts

// simple token estimate (~4 chars per token)
export function estimateTokens(text: string) {
    if (!text) return 0;
    return Math.max(1, Math.ceil(text.length / 4));
  }
  
  const COST_PER_1K_TOKENS = Number(process.env.NEXT_PUBLIC_COST_PER_1K_TOKENS ?? "0");
  
  export function estimateCostUSD(totalTokens: number) {
    if (!COST_PER_1K_TOKENS) return 0;
    return (totalTokens / 1000) * COST_PER_1K_TOKENS;
  }
  
  export type TrackPayload = {
    business_id: string;
    response_time_ms: number;
    session_id?: string;
    success_rate?: number;            // 1 success, 0 error
    tokens_used?: number;
    api_cost_usd?: number;
    model_name?: string;
    intent_detected?: string;
    appointment_requested?: boolean;
    human_handoff_requested?: boolean;
    appointment_booked?: boolean;
    user_message_length?: number;
    ai_response_length?: number;
    response_type?: "chat" | "error";
  };
  
  export async function trackMetrics(metrics: TrackPayload) {
    try {
      await fetch("http://localhost:5001/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metrics),
      });
    } catch (err) {
      console.error("Failed to track metrics:", err);
    }
  }
  