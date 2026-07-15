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

// Fetch admin dashboard overview metrics
export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const res = await fetch(`${backendBase()}/admin/overview`, {
        method: "GET",
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to fetch admin overview");
      }

      return await res.json();
    } catch (err: any) {
      console.error("adminOverview forwarding error:", err.message);
      throw err;
    }
  });

// Set/Update Jackpot Config
export const setJackpotConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { jackpot_amount_kes?: number; ticket_price_kes?: number; pool_min?: number; pool_max?: number; numbers_per_draw?: number; paused?: boolean; prize_tiers?: { match: number; prize_kes: number }[] }) => data)
  .handler(async ({ data }) => {
    try {
      const res = await fetch(`${backendBase()}/admin/config`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update jackpot config");
      }

      return await res.json();
    } catch (err: any) {
      console.error("setJackpotConfig forwarding error:", err.message);
      throw err;
    }
  });

// Block/Unblock user profile
export const setUserBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { userId: string; blocked: boolean }) => data)
  .handler(async ({ data }) => {
    try {
      const res = await fetch(`${backendBase()}/admin/user-blocked`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update user block status");
      }

      return await res.json();
    } catch (err: any) {
      console.error("setUserBlocked forwarding error:", err.message);
      throw err;
    }
  });
