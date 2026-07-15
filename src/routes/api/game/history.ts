import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/game/history")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { supabase } = await import("@/lib/db.server");
        const { verifyAuthToken, json } = await import("@/lib/auth.server");

        const decoded = await verifyAuthToken(request);
        if (!decoded) return json({ message: "Unauthorized" }, 401);

        try {
          const { data } = await supabase
            .from('runs')
            .select('id, matched_count, prize_kes, player_numbers, drawn_at, created_at, round_id')
            .eq('user_id', decoded.sub)
            .order('created_at', { ascending: false })
            .limit(50);

          return json(data || []);
        } catch (err: any) {
          console.error("[api/game/history] error:", err.message);
          return json({ message: err.message }, 500);
        }
      },
    },
  },
});