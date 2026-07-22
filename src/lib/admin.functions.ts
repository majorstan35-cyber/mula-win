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

      // 2. All payments (all statuses)
      const { data: allPayments } = await supabaseAdmin
        .from("payments")
        .select("id, amount_kes, status, phone, created_at, mpesa_checkout_request_id, run_id, user_id, mpesa_receipt")
        .order("created_at", { ascending: false })
        .limit(200);

      const paid = (allPayments ?? []).filter((p: any) => p.status === "paid");
      const failed = (allPayments ?? []).filter((p: any) => p.status === "failed");
      const pending = (allPayments ?? []).filter((p: any) => p.status === "pending");
      const cancelled = (allPayments ?? []).filter((p: any) => p.status === "cancelled");

      const totalRevenue = paid.reduce((acc: number, p: any) => acc + (p.amount_kes ?? 0), 0);
      const failedAttempts = failed.length + cancelled.length;
      const pendingCount = pending.length;

      // 3. Runs - all statuses
      const { data: allRuns } = await supabaseAdmin
        .from("runs")
        .select("id, user_id, prize_kes, matched_count, created_at, status")
        .order("created_at", { ascending: false })
        .limit(200);

      const drawnRuns = (allRuns ?? []).filter((r: any) => r.status === "drawn");
      const failedRuns = (allRuns ?? []).filter((r: any) => r.status === "failed");
      const pendingRuns = (allRuns ?? []).filter((r: any) => r.status === "pending");

      const totalPayouts = drawnRuns.reduce((acc: number, r: any) => acc + (r.prize_kes ?? 0), 0);
      const netMargin = totalRevenue - totalPayouts;

      // 4. Users list with profiles
      const { data: users } = await (supabaseAdmin as any)
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
        .limit(100);

      const formattedUsers = (users ?? []).map((u: any) => ({
        id: u.id,
        email: u.email,
        phone: u.phone,
        created_at: u.created_at,
        display_name: Array.isArray(u.profiles) ? u.profiles[0]?.display_name || u.email : u.profiles?.display_name || u.email,
        blocked: Array.isArray(u.profiles) ? u.profiles[0]?.blocked ?? false : u.profiles?.blocked ?? false,
      }));

      // 5. User comments
      let comments: any[] = [];
      try {
        const sb = supabaseAdmin as any;
        const { data: commentRows } = await sb
          .from("comments")
          .select(`
            id,
            comment_text,
            created_at,
            user_id,
            run_id
          `)
          .order("created_at", { ascending: false })
          .limit(100);

        if (commentRows) {
          comments = commentRows;
        }
      } catch (err: any) {
        console.warn("Could not fetch comments:", err.message);
      }

      // 6. Admin audit log
      let auditLog: any[] = [];
      try {
        const { data: audit } = await supabaseAdmin
          .from("admin_audit")
          .select("id, action, target, details, created_at, admin_id")
          .order("created_at", { ascending: false })
          .limit(50);
        auditLog = audit ?? [];
      } catch (err: any) {
        console.warn("Could not fetch audit log:", err.message);
      }

      return {
        metrics: {
          totalRevenue,
          totalPayouts,
          netMargin,
          runCount: drawnRuns.length,
          failedAttempts,
          pendingCount,
          totalSpins: (allRuns ?? []).length,
          failedRuns: failedRuns.length,
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
        recentRuns: allRuns ?? [],
        comments,
        auditLog,
        // Payment breakdown by status
        payments: {
          paid: paid.slice(0, 100),
          failed: failed.slice(0, 100),
          pending: pending.slice(0, 50),
          cancelled: cancelled.slice(0, 100),
        },
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

// Manually mark a pending payment as failed (admin override)
export const markPaymentFailed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { paymentId: string; runId?: string }) => data)
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      await supabaseAdmin
        .from("payments")
        .update({ status: "failed" })
        .eq("id", data.paymentId);

      if (data.runId) {
        await supabaseAdmin
          .from("runs")
          .update({ status: "failed" })
          .eq("id", data.runId);
      }

      return { success: true };
    } catch (err: any) {
      console.error("markPaymentFailed error:", err.message);
      throw err;
    }
  });

// Grant a free spin to a user (admin tool)
export const grantFreeSpin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ free_spins: 1 })
        .eq("id", data.userId);

      if (error) throw new Error(error.message);
      return { success: true };
    } catch (err: any) {
      console.error("grantFreeSpin error:", err.message);
      throw err;
    }
  });
