import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.STRIPE_LIVE_API_KEY;
        if (!secret) {
          console.error("[paystack-webhook] missing secret");
          return new Response("Server misconfigured", { status: 500 });
        }

        const raw = await request.text();
        const signature = request.headers.get("x-paystack-signature") ?? "";
        const expected = createHmac("sha512", secret).update(raw).digest("hex");

        try {
          const a = Buffer.from(signature, "hex");
          const b = Buffer.from(expected, "hex");
          if (a.length !== b.length || !timingSafeEqual(a, b)) {
            return new Response("Invalid signature", { status: 401 });
          }
        } catch {
          return new Response("Invalid signature", { status: 401 });
        }

        let event: any;
        try {
          event = JSON.parse(raw);
        } catch {
          return new Response("Invalid body", { status: 400 });
        }

        // Only act on successful charges
        if (event?.event !== "charge.success") {
          return new Response("ok"); // ack other events
        }

        const reference: string | undefined = event?.data?.reference;
        const mpesaReceipt: string | undefined =
          event?.data?.authorization?.receiver_bank_account_number ||
          event?.data?.mobile_money?.receipt ||
          event?.data?.reference;

        if (!reference) return new Response("no reference", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Find payment
        const { data: payment } = await supabaseAdmin
          .from("payments")
          .select("id, run_id, user_id, status")
          .eq("mpesa_checkout_request_id", reference)
          .maybeSingle();
        if (!payment) return new Response("payment not found", { status: 404 });

        if (payment.status === "paid") return new Response("already processed");

        // Mark payment paid
        await supabaseAdmin
          .from("payments")
          .update({
            status: "paid",
            mpesa_receipt: mpesaReceipt ?? reference,
            raw_callback: event,
          })
          .eq("id", payment.id);

        // Settle the draw
        const { data: run } = await supabaseAdmin
          .from("runs")
          .select("id, round_id, player_numbers, status")
          .eq("id", payment.run_id!)
          .maybeSingle();

        if (!run) return new Response("run not found", { status: 404 });
        if (run.status === "drawn") return new Response("already drawn");

        const { data: round } = await supabaseAdmin
          .from("rounds")
          .select("id, target_numbers")
          .eq("id", run.round_id)
          .maybeSingle();
        if (!round) return new Response("round not found", { status: 404 });

        const { data: config } = await supabaseAdmin
          .from("jackpot_config")
          .select("prize_tiers")
          .eq("active", true)
          .maybeSingle();

        const targetSet = new Set<number>(round.target_numbers as number[]);
        const picks = (run.player_numbers as number[]) ?? [];
        const matched = picks.filter((n) => targetSet.has(n)).length;
        const tiers =
          (config?.prize_tiers as { match: number; prize_kes: number }[] | undefined) ?? [];
        const tier = tiers
          .filter((t) => matched >= t.match)
          .sort((a, b) => b.match - a.match)[0];
        const prize = tier?.prize_kes ?? 0;

        await supabaseAdmin
          .from("runs")
          .update({
            status: "drawn",
            matched_count: matched,
            prize_kes: prize,
            drawn_at: new Date().toISOString(),
          })
          .eq("id", run.id);

        return new Response("ok");
      },
    },
  },
});
