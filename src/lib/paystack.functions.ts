import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function backendBase(): string {
  if (process.env.BACKEND_API_URL) return process.env.BACKEND_API_URL;
  const req = getRequest();
  const origin = req?.url ? new URL(req.url).origin : `http://localhost:${process.env.PORT || 3000}`;
  return origin + "/api";
}

function getAuthHeaders() {
  const request = getRequest();
  const authHeader = request?.headers?.get("authorization");
  return authHeader
    ? { Authorization: authHeader, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

// Kick off M-Pesa STK push via local backend
export const initiateMpesaCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { picks: number[]; phone: string }) => data)
  .handler(async ({ data }) => {
    try {
      const res = await fetch(`${backendBase()}/payments/initiate-charge`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to initiate payment");
      }

      return await res.json();
    } catch (err: any) {
      console.error("initiateMpesaCharge forwarding error:", err.message);
      throw err;
    }
  });

// Poll the status of the run / payment
export const getRunStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: { runId: string }) => data)
  .handler(async ({ data }) => {
    try {
      const res = await fetch(`${backendBase()}/payments/run-status/${data.runId}`, {
        method: "GET",
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to check run status");
      }

      return await res.json();
    } catch (err: any) {
      console.error("getRunStatus forwarding error:", err.message);
      throw err;
    }
  });
