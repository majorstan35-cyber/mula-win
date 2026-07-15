import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Profile data shape returned to the client.
 */
interface Profile {
  id: string;
  phone: string;
  display_name: string;
  blocked: boolean;
  created_at: string;
}

export const Route = createFileRoute("/api/auth/profiles/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Lazy‑load server utilities to keep the bundle small.
        const { supabase } = await import("@/lib/db.server");
        const { verifyAuthToken, json } = await import("@/lib/auth.server");

        // Verify JWT / session token.
        const decoded = await verifyAuthToken(request);
        if (!decoded) return json({ message: "Unauthorized" }, 401);

        try {
          // Query the profile row for the authenticated user.
          const { data, error } = await (supabase as SupabaseClient)
            .from("profiles")
            .select("id, phone, display_name, blocked, created_at")
            .eq("id", decoded.sub)
            .maybeSingle();

          if (error) throw error;
          if (!data) return json({ message: "Profile not found" }, 404);

          // Explicitly type the response for better IDE support.
          const profile: Profile = data as Profile;
          return json(profile);
        } catch (err: any) {
          console.error("[api/auth/profiles/me] error:", err?.message ?? err);
          return json({ message: err?.message ?? "Internal Server Error" }, 500);
        }
      },
    },
  },
});