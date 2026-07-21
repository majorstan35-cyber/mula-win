import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Fetch admin dashboard overview metrics + user comments
export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // 1. Config
      const { data: config } = await supabaseAdmin
        .from("jackpot_config")
        .select("*")
        .eq("active", true)
        .maybeSingle();

      // 2. Payments revenue & payouts
      const { data: payments } = await supabaseAdmin
        .from("payments")
        .select("amount_kes, status")
        .eq("status", "paid");

      const totalRevenue = (payments ?? []).reduce((acc: number, p: any) => acc + (p.amount_kes ?? 0), 0);

      const { data: drawnRuns } = await supabaseAdmin
        .from("runs")
        .select("id, prize_kes, matched_count, created_at")
        .eq("status", "drawn");

      const totalPayouts = (drawnRuns ?? []).reduce((acc: number, r: any) => acc + (r.prize_kes ?? 0), 0);
      const runCount = drawnRuns?.length ?? 0;
      const netMargin = totalRevenue - totalPayouts;

      // 3. Users list with profiles
      const { data: users } = await supabaseAdmin
        .from("users")
        .select(`
          id,
          email,
          phone,
          created_at,
          profiles (
            display_name,
            blocked
          )
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      const formattedUsers = (users ?? []).map((u: any) => ({
        id: u.id,
        email: u.email,
        phone: u.phone,
        created_at: u.created_at,
        display_name: Array.isArray(u.profiles) ? u.profiles[0]?.display_name || u.email : u.profiles?.display_name || u.email,
        blocked: Array.isArray(u.profiles) ? u.profiles[0]?.blocked ?? false : u.profiles?.blocked ?? false,
      }));

      // 4. Recent runs
      const { data: recentRuns } = await supabaseAdmin
        .from("runs")
        .select("id, matched_count, prize_kes, created_at, status")
        .order("created_at", { ascending: false })
        .limit(30);

      // 5. User comments
      let comments: any[] = [];
      try {
        const { data: commentRows } = await supabaseAdmin
          .from("comments")
          .select(`
            id,
            comment_text,
            created_at,
            user_id,
            run_id,
            profiles (
              display_name,
              phone
            ),
            users (
              email
            )
          `)
          .order("created_at", { ascending: false })
          .limit(50);

        if (commentRows) {
          comments = commentRows.map((c: any) => {
            const prof = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
            const usr = Array.isArray(c.users) ? c.users[0] : c.users;
            return {
              id: c.id,
              comment_text: c.comment_text,
              created_at: c.created_at,
              user_id: c.user_id,
              run_id: c.run_id,
              display_name: prof?.display_name || usr?.email || "Player",
              phone: prof?.phone || "",
            };
          });
        }
      } catch (err: any) {
        console.warn("Could not fetch comments:", err.message);
      }

      return {
        metrics: {
          totalRevenue,
          totalPayouts,
          netMargin,
          runCount,
        },
        config: config ?? {
          jackpot_amount_kes: 1000000,
          ticket_price_kes: 200,
          pool_min: 1,
          pool_max: 40,
          numbers_per_draw: 12,
          paused: false,
          prize_tiers: [
            { match: 12, prize_kes: 1000000 },
            { match: 11, prize_kes: 50000 },
            { match: 10, prize_kes: 10000 },
            { match: 9, prize_kes: 1000 },
          ],
        },
        users: formattedUsers,
        recentRuns: recentRuns ?? [],
        comments,
      };
    } catch (err: any) {
      console.error("adminOverview error:", err.message);
      throw err;
    }
  });

// Set/Update Jackpot Config
export const setJackpotConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { jackpot_amount_kes?: number; ticket_price_kes?: number; pool_min?: number; pool_max?: number; numbers_per_draw?: number; paused?: boolean; prize_tiers?: { match: number; prize_kes: number }[] }) => data)
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: updated, error } = await supabaseAdmin
        .from("jackpot_config")
        .update(data)
        .eq("active", true)
        .select("*")
        .single();

      if (error) throw new Error(error.message);
      return updated;
    } catch (err: any) {
      console.error("setJackpotConfig error:", err.message);
      throw err;
    }
  });

// Block/Unblock user profile
export const setUserBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { userId: string; blocked: boolean }) => data)
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ blocked: data.blocked })
        .eq("id", data.userId);

      if (error) throw new Error(error.message);
      return { success: true };
    } catch (err: any) {
      console.error("setUserBlocked error:", err.message);
      throw err;
    }
  });
