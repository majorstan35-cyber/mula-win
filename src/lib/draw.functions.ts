import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Server functions run on the SSR server. Prefer an explicit BACKEND_API_URL;
// otherwise derive the origin from the incoming request so it works on any host/port
// (Hostinger does not serve the app on localhost:3000).
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

// Public: fetch active jackpot config + current open round commit (seed_hash)
export const getPublicState = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const res = await fetch(`${backendBase()}/game/public-state`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Failed to fetch public state");
    }
    return await res.json();
  } catch (err: any) {
    console.error("getPublicState forwarding error:", err.message);
    throw err;
  }
});

// Authenticated: create a run + payment + draw numbers immediately.
export const playNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { phone?: string; picks?: number[] }) => data ?? {})
  .handler(async ({ data }) => {
    try {
      const res = await fetch(`${backendBase()}/game/play`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Play failed");
      }
      return await res.json();
    } catch (err: any) {
      console.error("playNow forwarding error:", err.message);
      throw err;
    }
  });

// Authenticated: history
export const getMyHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const res = await fetch(`${backendBase()}/game/history`, {
        method: "GET",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to fetch history");
      }
      return await res.json();
    } catch (err: any) {
      console.error("getMyHistory forwarding error:", err.message);
      throw err;
    }
  });
