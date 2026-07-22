import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Reconcile pending payments against Paystack API
export const reconcilePendingPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const secretKey = process.env.PAYSTACK_SECRET_KEY || process.env.STRIPE_LIVE_API_KEY;

      const { data: pendingList } = await supabaseAdmin
        .from("payments")
        .select("id, run_id, mpesa_checkout_request_id, created_at")
        .eq("status", "pending");

      if (!pendingList || pendingList.length === 0) {
        return { reconciled: 0, settled: 0, failed: 0 };
      }

      let settledCount = 0;
      let failedCount = 0;

      for (const p of pendingList as any[]) {
        if (!p.mpesa_checkout_request_id) {
          await supabaseAdmin.from("payments").update({ status: "cancelled" }).eq("id", p.id);
          if (p.run_id) await supabaseAdmin.from("runs").update({ status: "failed" }).eq("id", p.run_id);
          failedCount++;
          continue;
        }

        try {
          const res = await fetch(`https://api.paystack.co/transaction/verify/${p.mpesa_checkout_request_id}`, {
            headers: { Authorization: `Bearer ${secretKey}` }
          });
          const payload = await res.json();
          const pStatus = payload?.data?.status;

          if (pStatus === "success") {
            const mpesaReceipt =
              payload?.data?.authorization?.receiver_bank_account_number ||
              payload?.data?.mobile_money?.receipt ||
              p.mpesa_checkout_request_id;

            await supabaseAdmin
              .from("payments")
              .update({ status: "paid", mpesa_receipt: mpesaReceipt, raw_callback: payload })
              .eq("id", p.id);

            if (p.run_id) {
              const { settleDraw } = await import("@/lib/game.server");
              await settleDraw(p.run_id, supabaseAdmin);
            }
            settledCount++;
            console.log(`[Reconcile] Pending payment ${p.id} settled as PAID!`);
          } else {
            const ageMins = (Date.now() - new Date(p.created_at).getTime()) / 60000;
            if (pStatus === "failed") {
              // PIN entered but declined / insufficient funds / failed at bank
              await supabaseAdmin.from("payments").update({ status: "failed", raw_callback: payload }).eq("id", p.id);
              if (p.run_id) await supabaseAdmin.from("runs").update({ status: "failed" }).eq("id", p.run_id);
              failedCount++;
            } else if (pStatus === "abandoned" || ageMins > 5) {
              // Dismissed or no PIN entered within timeout -> cancelled
              await supabaseAdmin.from("payments").update({ status: "cancelled", raw_callback: payload }).eq("id", p.id);
              if (p.run_id) await supabaseAdmin.from("runs").update({ status: "failed" }).eq("id", p.run_id);
              failedCount++;
            }
          }
        } catch (err: any) {
          const ageMins = (Date.now() - new Date(p.created_at).getTime()) / 60000;
          if (ageMins > 5) {
            await supabaseAdmin.from("payments").update({ status: "cancelled" }).eq("id", p.id);
            if (p.run_id) await supabaseAdmin.from("runs").update({ status: "failed" }).eq("id", p.run_id);
            failedCount++;
          }
        }
      }

      return { reconciled: pendingList.length, settled: settledCount, failed: failedCount };
    } catch (err: any) {
      console.error("reconcilePendingPayments error:", err.message);
      throw err;
    }
  });

// Fetch admin dashboard overview metrics + user comments
export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // Auto-reconcile old pendings before computing metrics
      try {
        const secretKey = process.env.PAYSTACK_SECRET_KEY || process.env.STRIPE_LIVE_API_KEY;
        const { data: oldPendings } = await supabaseAdmin
          .from("payments")
          .select("id, run_id, mpesa_checkout_request_id, created_at")
          .eq("status", "pending");

        if (oldPendings && oldPendings.length > 0) {
          for (const p of oldPendings as any[]) {
            const ageMins = (Date.now() - new Date(p.created_at).getTime()) / 60000;
            if (p.mpesa_checkout_request_id) {
              try {
                const res = await fetch(`https://api.paystack.co/transaction/verify/${p.mpesa_checkout_request_id}`, {
                  headers: { Authorization: `Bearer ${secretKey}` }
                });
                const payload = await res.json();
                const pStatus = payload?.data?.status;

                if (pStatus === "success") {
                  const mpesaReceipt =
                    payload?.data?.authorization?.receiver_bank_account_number ||
                    payload?.data?.mobile_money?.receipt ||
                    p.mpesa_checkout_request_id;

                  await supabaseAdmin
                    .from("payments")
                    .update({ status: "paid", mpesa_receipt: mpesaReceipt, raw_callback: payload })
                    .eq("id", p.id);

                  if (p.run_id) {
                    const { settleDraw } = await import("@/lib/game.server");
                    await settleDraw(p.run_id, supabaseAdmin);
                  }
                } else if (pStatus === "failed") {
                  await supabaseAdmin.from("payments").update({ status: "failed", raw_callback: payload }).eq("id", p.id);
                  if (p.run_id) await supabaseAdmin.from("runs").update({ status: "failed" }).eq("id", p.run_id);
                } else if (pStatus === "abandoned" || ageMins > 5) {
                  await supabaseAdmin.from("payments").update({ status: "cancelled", raw_callback: payload }).eq("id", p.id);
                  if (p.run_id) await supabaseAdmin.from("runs").update({ status: "failed" }).eq("id", p.run_id);
                }
              } catch (e) {
                if (ageMins > 5) {
                  await supabaseAdmin.from("payments").update({ status: "cancelled" }).eq("id", p.id);
                  if (p.run_id) await supabaseAdmin.from("runs").update({ status: "failed" }).eq("id", p.run_id);
                }
              }
            } else {
              await supabaseAdmin.from("payments").update({ status: "cancelled" }).eq("id", p.id);
              if (p.run_id) await supabaseAdmin.from("runs").update({ status: "failed" }).eq("id", p.run_id);
            }
          }
        }
      } catch (recErr: any) {
        console.warn("Auto reconciliation warning:", recErr.message);
      }

      // 1. Config
      const { data: config } = await supabaseAdmin
        .from("jackpot_config")
        .select("*")
        .eq("active", true)
        .maybeSingle();

      // 2. Fetch ALL paid payments for total revenue calculation without limit
      const { data: allPaidPayments } = await supabaseAdmin
        .from("payments")
        .select("amount_kes")
        .eq("status", "paid");

      const totalRevenue = (allPaidPayments ?? []).reduce((acc: number, p: any) => acc + (p.amount_kes ?? 0), 0);
      const totalPaidCount = allPaidPayments?.length ?? 0;

      // Fetch recent payments for table display (up to 500)
      const { data: allPayments } = await supabaseAdmin
        .from("payments")
        .select("id, amount_kes, status, phone, created_at, mpesa_checkout_request_id, run_id, user_id, mpesa_receipt")
        .order("created_at", { ascending: false })
        .limit(500);

      const paid = (allPayments ?? []).filter((p: any) => p.status === "paid");
      const failed = (allPayments ?? []).filter((p: any) => p.status === "failed");
      const pending = (allPayments ?? []).filter((p: any) => p.status === "pending");
      const cancelled = (allPayments ?? []).filter((p: any) => p.status === "cancelled");

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
          totalPaidCount,
          totalPayouts,
          netMargin,
          runCount: drawnRuns.length,
          failedCount: failed.length,
          cancelledCount: cancelled.length,
          pendingCount: pending.length,
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
        payments: {
          paid,
          failed,
          pending,
          cancelled,
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
