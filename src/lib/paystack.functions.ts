import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

      // 4. Create pending run
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

      // 5. Generate a unique transaction reference and format phone
      const reference = `spin_${run.id.slice(0, 8)}_${crypto.randomUUID().slice(0, 8)}`;
      
      let formattedPhone = phone.replace(/\D/g, "");
      if (formattedPhone.startsWith("0")) {
        formattedPhone = "254" + formattedPhone.slice(1);
      } else if (formattedPhone.startsWith("7") || formattedPhone.startsWith("1")) {
        formattedPhone = "254" + formattedPhone;
      }
      // Ensure the format is 254XXXXXXXXX or similar expected by Paystack
      if (!formattedPhone.startsWith("254") || formattedPhone.length !== 12) {
        throw new Error("Invalid Kenyan phone number format. Use e.g. 0712345678");
      }

      const paystackPhone = "+" + formattedPhone;

      // 6. Call Paystack API to charge Mobile Money
      const paystackSecret = process.env.PAYSTACK_SECRET_KEY || process.env.STRIPE_LIVE_API_KEY;
      if (!paystackSecret) {
        throw new Error("Paystack secret key is not configured on the server.");
      }

      const chargeRes = await fetch("https://api.paystack.co/charge", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${paystackSecret}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: email,
          amount: config.ticket_price_kes * 100, // Paystack amounts are in cents/subunits
          currency: "KES",
          reference: reference,
          mobile_money: {
            phone: paystackPhone,
            provider: "mpesa"
          }
        })
      });

      const chargePayload = await chargeRes.json();
      if (!chargeRes.ok || !chargePayload.status) {
        console.error("Paystack charge API error response:", chargePayload);
        throw new Error(chargePayload.message || "Failed to initiate Paystack charge.");
      }

      // 7. Save pending payment record in DB
      const { error: payErr } = await supabaseAdmin
        .from('payments')
        .insert({
          user_id: userId,
          run_id: run.id,
          amount_kes: config.ticket_price_kes,
          phone: paystackPhone,
          mpesa_checkout_request_id: reference,
          status: 'pending'
        });

      if (payErr) {
        console.error("Failed to insert payment record:", payErr.message);
      }

      return {
        runId: run.id,
        displayText: chargePayload.data?.display_text || "Please enter your M-Pesa PIN on your phone to complete the payment."
      };

    } catch (err: any) {
      console.error("initiateMpesaCharge error:", err.message);
      throw err;
    }
  });

// Poll the status of the run / payment directly via DB queries
export const getRunStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: { runId: string }) => data)
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // 1. Fetch the run with its associated round details
      const { data: run, error: runErr } = await supabaseAdmin
        .from('runs')
        .select(`
          id,
          status,
          player_numbers,
          matched_count,
          prize_kes,
          round_id
        `)
        .eq('id', data.runId)
        .maybeSingle();

      if (runErr || !run) {
        throw new Error(runErr?.message || "Game run not found.");
      }

      // If drawn, we can return the complete state immediately
      if (run.status === "drawn") {
        const { data: round } = await supabaseAdmin
          .from('rounds')
          .select('round_number, seed_hash, target_numbers')
          .eq('id', run.round_id)
          .maybeSingle();

        if (!round) throw new Error("Round details not found.");

        return {
          runStatus: "drawn",
          run: {
            id: run.id,
            player_numbers: run.player_numbers,
            matched_count: run.matched_count ?? 0,
            prize_kes: run.prize_kes ?? 0,
          },
          target: round.target_numbers,
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
        .select('status')
        .eq('run_id', data.runId)
        .maybeSingle();

      if (payment && payment.status === "failed") {
        // Update run status to failed in the DB
        await supabaseAdmin
          .from('runs')
          .update({ status: 'failed' })
          .eq('id', data.runId);

        return { runStatus: "failed" };
      }

      return { runStatus: "pending" };

    } catch (err: any) {
      console.error("getRunStatus error:", err.message);
      throw err;
    }
  });
