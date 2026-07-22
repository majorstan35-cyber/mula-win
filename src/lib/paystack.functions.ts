import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Helper function to call Paystack API with active live secret key
async function callPaystackApi(endpoint: string, options: any = {}) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY || process.env.STRIPE_LIVE_API_KEY;


  try {
    const res = await fetch(`https://api.paystack.co/${endpoint}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
        "Authorization": `Bearer ${secretKey}`,
        "Content-Type": "application/json"
      }
    });
    const payload = await res.json();
    console.log(`[Paystack API] ${options.method ?? "GET"} /${endpoint} -> HTTP ${res.status}:`, payload.status, payload.message || "");
    return payload;
  } catch (e) {
    console.error(`[Paystack API] Exception calling /${endpoint}:`, e);
    return { status: false, message: "Paystack API connection failed" };
  }
}

// Kick off M-Pesa STK push via Paystack API directly on the server
export const initiateMpesaCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { picks: number[]; phone: string }) => data)
  .handler(async ({ data, context }) => {
    const { picks, phone } = data;
    const userId = context.userId;
    const email = context.claims?.email || `${userId}@luckyspin.co.ke`;

    try {
      const crypto = await import("crypto");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // 1. Get active jackpot config
      const { data: config } = await supabaseAdmin
        .from('jackpot_config')
        .select('*')
        .eq('active', true)
        .maybeSingle();

      if (!config) throw new Error("No active jackpot configuration found.");
      if (config.paused) throw new Error("Draws are currently paused.");

      // 2. Validate picks length, uniqueness, and bounds
      const need = config.numbers_per_draw;
      if (!Array.isArray(picks) || picks.length !== need) {
        throw new Error(`You must pick exactly ${need} numbers.`);
      }
      const unique = new Set(picks);
      if (unique.size !== picks.length) {
        throw new Error("Numbers must be unique.");
      }
      for (const n of picks) {
        if (!Number.isInteger(n) || n < config.pool_min || n > config.pool_max) {
          throw new Error(`Numbers must be between ${config.pool_min} and ${config.pool_max}.`);
        }
      }

      // 3. Get current open round
      const { data: round } = await supabaseAdmin
        .from('rounds')
        .select('*')
        .eq('status', 'open')
        .order('round_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!round) throw new Error("No open round available.");

      // 4. Auto-resolve & clear old pending payments for this user — NEVER block the user
      const { data: oldPending } = await supabaseAdmin
        .from('payments')
        .select('id, run_id, mpesa_checkout_request_id, created_at')
        .eq('user_id', userId)
        .eq('status', 'pending');

      if (oldPending && oldPending.length > 0) {
        console.log(`[Paystack] Resolving ${oldPending.length} old pending payment(s) for user ${userId}`);
        for (const p of oldPending as any[]) {
          const ageSecs = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 1000);
          // If older than 15s, verify with Paystack to see if it was paid
          if (ageSecs >= 15 && p.mpesa_checkout_request_id) {
            try {
              const verifyResp = await callPaystackApi(`transaction/verify/${p.mpesa_checkout_request_id}`, { method: "GET" });
              if (verifyResp?.data?.status === "success") {
                await supabaseAdmin.from('payments').update({ status: 'paid', raw_callback: verifyResp }).eq('id', p.id);
                const { settleDraw } = await import("@/lib/game.server");
                await settleDraw(p.run_id, supabaseAdmin);
                console.log(`[Paystack] Old pending payment ${p.id} resolved as PAID`);
                continue;
              }
            } catch (vErr) {
              // ignore
            }
          }
          // Mark old pending as cancelled so user isn't stuck
          await supabaseAdmin.from('payments').update({ status: 'cancelled' }).eq('id', p.id);
          if (p.run_id) {
            await supabaseAdmin.from('runs').update({ status: 'failed' }).eq('id', p.run_id);
          }
        }
      }

      // 5. Create pending run
      const { data: run, error: runErr } = await supabaseAdmin
        .from('runs')
        .insert({
          user_id: userId,
          round_id: round.id,
          status: 'pending',
          player_numbers: picks
        })
        .select('*')
        .single();

      if (runErr || !run) {
        throw new Error(runErr?.message || "Failed to create game run.");
      }

      // Count user's paid payments to compute auto-incrementing amount:
      // Spin 1: KES 200 | Spin 2: KES 201 | Spin 3: KES 203 | Spin 4: KES 205 ...
      const { count: paidCount } = await supabaseAdmin
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'paid');

      const spinIndex = paidCount || 0;
      let chargeAmount = config.ticket_price_kes ?? 200;
      if (spinIndex === 1) {
        chargeAmount = 201;
      } else if (spinIndex >= 2) {
        chargeAmount = 200 + (spinIndex * 2 - 1);
      }

      // 6. Format phone number
      let formattedPhone = phone.replace(/\D/g, "");
      if (formattedPhone.startsWith("0")) {
        formattedPhone = "254" + formattedPhone.slice(1);
      } else if (formattedPhone.startsWith("7") || formattedPhone.startsWith("1")) {
        formattedPhone = "254" + formattedPhone;
      }
      if (!formattedPhone.startsWith("254") || formattedPhone.length !== 12) {
        await supabaseAdmin.from('runs').update({ status: 'failed' }).eq('id', run.id);
        throw new Error("Invalid Kenyan phone number format. Use e.g. 0712345678");
      }

      const paystackPhone = "+" + formattedPhone;
      const reference = `spin_${run.id.slice(0, 8)}_${crypto.randomUUID().slice(0, 8)}`;

      // 7. Initiate Paystack STK Push charge
      console.log(`[Paystack] Initiating STK push: phone=${paystackPhone}, ref=${reference}, KES=${chargeAmount}`);

      let chargePayload = await callPaystackApi("charge", {
        method: "POST",
        body: JSON.stringify({
          email: email,
          amount: chargeAmount * 100, // in cents/subunits
          currency: "KES",
          reference: reference,
          mobile_money: {
            phone: paystackPhone,
            provider: "mpesa"
          }
        })
      });

      let finalRef = chargePayload?.data?.reference || reference;

      // Handle unprocessed_transaction retry automatically
      if (!chargePayload.status) {
        const errCode = chargePayload.code || "";
        const errMsg = chargePayload.message || "";
        console.warn(`[Paystack] Initial charge status false: code=${errCode}, msg=${errMsg}`);

        if (errCode === "unprocessed_transaction" || errMsg.includes("Charge attempted")) {
          // Verify stuck reference on Paystack to clear server lock, then retry with fresh reference
          try {
            await callPaystackApi(`transaction/verify/${finalRef}`, { method: "GET" });
          } catch { }

          const retryRef = `spin_${run.id.slice(0, 8)}_${crypto.randomUUID().slice(0, 8)}`;
          console.log(`[Paystack] Retrying with clean ref=${retryRef}`);

          const retryPayload = await callPaystackApi("charge", {
            method: "POST",
            body: JSON.stringify({
              email: email,
              amount: chargeAmount * 100,
              currency: "KES",
              reference: retryRef,
              mobile_money: {
                phone: paystackPhone,
                provider: "mpesa"
              }
            })
          });

          if (retryPayload.status) {
            chargePayload = retryPayload;
            finalRef = retryPayload?.data?.reference || retryRef;
          } else {
            // Fallback: try initializing transaction to give user authorization URL if needed
            const initPayload = await callPaystackApi("transaction/initialize", {
              method: "POST",
              body: JSON.stringify({
                email: email,
                amount: chargeAmount * 100,
                currency: "KES",
                reference: retryRef,
                channels: ["mobile_money"]
              })
            });

            if (initPayload.status && initPayload.data?.reference) {
              finalRef = initPayload.data.reference;
              chargePayload = initPayload;
            } else {
              await supabaseAdmin.from('runs').update({ status: 'failed' }).eq('id', run.id);
              throw new Error(retryPayload.message || "Payment request failed. Please wait 1 minute and try again.");
            }
          }
        } else {
          await supabaseAdmin.from('runs').update({ status: 'failed' }).eq('id', run.id);
          throw new Error(errMsg || "Failed to initiate M-Pesa payment.");
        }
      }

      // 8. Save payment record in DB
      const { error: payErr } = await supabaseAdmin
        .from('payments')
        .insert({
          user_id: userId,
          run_id: run.id,
          amount_kes: chargeAmount,
          phone: paystackPhone,
          mpesa_checkout_request_id: finalRef,
          status: 'pending'
        });

      if (payErr) {
        console.error("[Paystack] Failed to insert payment record:", payErr.message);
      }

      return {
        runId: run.id,
        amountKes: chargeAmount,
        displayText: `Check your phone! Enter your M-Pesa PIN to complete KES ${chargeAmount} payment.`
      };

    } catch (err: any) {
      console.error("[Paystack] initiateMpesaCharge error:", err.message);
      throw err;
    }
  });

// Poll the status of the run / payment directly via DB queries and Paystack API
export const getRunStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: { runId: string }) => data)
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // 1. Fetch the run
      const { data: run, error: runErr } = await supabaseAdmin
        .from('runs')
        .select(`
          id,
          user_id,
          status,
          player_numbers,
          matched_count,
          prize_kes,
          round_id,
          created_at
        `)
        .eq('id', data.runId)
        .maybeSingle();

      if (runErr || !run) {
        throw new Error(runErr?.message || "Game run not found.");
      }

      // If drawn, return complete state
      if (run.status === "drawn") {
        const { data: round } = await supabaseAdmin
          .from('rounds')
          .select('round_number, seed_hash, target_numbers')
          .eq('id', run.round_id)
          .maybeSingle();

        if (!round) throw new Error("Round details not found.");

        const { data: config } = await supabaseAdmin
          .from("jackpot_config")
          .select("pool_min, pool_max")
          .eq("active", true)
          .maybeSingle();

        const poolMin = config?.pool_min ?? 1;
        const poolMax = config?.pool_max ?? 40;

        const { count } = await supabaseAdmin
          .from("runs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", run.user_id)
          .eq("status", "drawn")
          .lt("created_at", run.created_at);

        const prevDrawnCount = count ?? 0;

        const { getTargetNumbersForRun } = await import("@/lib/game.server");
        const targetNumbers = getTargetNumbersForRun(
          { ...run, player_numbers: run.player_numbers ?? [] },
          round.target_numbers,
          prevDrawnCount,
          poolMin,
          poolMax
        );

        return {
          runStatus: "drawn",
          run: {
            id: run.id,
            player_numbers: run.player_numbers,
            matched_count: run.matched_count ?? 0,
            prize_kes: run.prize_kes ?? 0,
          },
          target: targetNumbers,
          seedHash: round.seed_hash,
          roundNumber: round.round_number
        };
      }

      // If failed, return failed
      if (run.status === "failed") {
        return { runStatus: "failed" };
      }

      // If pending, check the payment status
      const { data: payment } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('run_id', data.runId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!payment) {
        return { runStatus: "pending" };
      }

      if (payment.status === "failed" || payment.status === "cancelled") {
        await supabaseAdmin
          .from('runs')
          .update({ status: 'failed' })
          .eq('id', data.runId);

        return { runStatus: "failed" };
      }

      if (payment.status === "paid") {
        try {
          const { settleDraw } = await import("@/lib/game.server");
          const settled = await settleDraw(data.runId, supabaseAdmin);
          return {
            runStatus: "drawn",
            run: {
              id: settled.run.id,
              player_numbers: settled.run.player_numbers,
              matched_count: settled.run.matched_count ?? 0,
              prize_kes: settled.run.prize_kes ?? 0,
            },
            target: settled.target,
            seedHash: settled.seedHash,
            roundNumber: settled.roundNumber
          };
        } catch (err: any) {
          console.error("Error settling draw for already paid payment:", err.message);
          return { runStatus: "pending" };
        }
      }

      // Check Paystack directly if payment is pending
      if (payment.status === "pending" && payment.mpesa_checkout_request_id) {
        try {
          const verifyPayload = await callPaystackApi(`transaction/verify/${payment.mpesa_checkout_request_id}`, {
            method: "GET"
          });

          if (verifyPayload.status && verifyPayload.data) {
            const paystackStatus = verifyPayload.data.status;
            const mpesaReceipt =
              verifyPayload.data.authorization?.receiver_bank_account_number ||
              verifyPayload.data.mobile_money?.receipt ||
              verifyPayload.data.reference;

            if (paystackStatus === "success") {
              await supabaseAdmin
                .from('payments')
                .update({
                  status: "paid",
                  mpesa_receipt: mpesaReceipt || payment.mpesa_checkout_request_id,
                  raw_callback: verifyPayload
                })
                .eq("id", payment.id);

              const { settleDraw } = await import("@/lib/game.server");
              const settled = await settleDraw(data.runId, supabaseAdmin);

              return {
                runStatus: "drawn",
                run: {
                  id: settled.run.id,
                  player_numbers: settled.run.player_numbers,
                  matched_count: settled.run.matched_count ?? 0,
                  prize_kes: settled.run.prize_kes ?? 0,
                },
                target: settled.target,
                seedHash: settled.seedHash,
                roundNumber: settled.roundNumber
              };
            } else if (paystackStatus === "failed" || paystackStatus === "abandoned") {
              await supabaseAdmin
                .from('payments')
                .update({ status: "failed", raw_callback: verifyPayload })
                .eq("id", payment.id);

              await supabaseAdmin
                .from('runs')
                .update({ status: 'failed' })
                .eq('id', data.runId);

              return { runStatus: "failed" };
            }
          }
        } catch (err: any) {
          console.error("Direct Paystack verification failed during polling:", err.message);
        }
      }

      return { runStatus: "pending" };

    } catch (err: any) {
      console.error("getRunStatus error:", err.message);
      throw err;
    }
  });

// Submit user comment after a spin
export const submitUserComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { runId?: string; commentText: string }) => data)
  .handler(async ({ data, context }) => {
    const { runId, commentText } = data;
    const userId = context.userId;

    if (!commentText || !commentText.trim()) {
      return { success: true };
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const cleanText = commentText.trim().slice(0, 500);

      const sb = supabaseAdmin as any;
      const { data: inserted, error } = await sb
        .from("comments")
        .insert({
          user_id: userId,
          run_id: runId || null,
          comment_text: cleanText,
        })
        .select("*")
        .single();

      if (error) {
        console.warn("Could not save comment to database:", error.message);
      }

      return { success: true, comment: inserted ?? null };
    } catch (err: any) {
      console.warn("submitUserComment error caught silently:", err.message);
      return { success: true, comment: null };
    }
  });
