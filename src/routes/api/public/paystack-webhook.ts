import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PAYSTACK_SECRET_KEY || process.env.STRIPE_LIVE_API_KEY;
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

        // Settle the draw using the shared helper
        try {
          const { settleDraw } = await import("@/lib/game.server");
          await settleDraw(payment.run_id!, supabaseAdmin);
        } catch (err: any) {
          console.error("[paystack-webhook] failed to settle draw:", err.message);
          return new Response("Failed to settle draw", { status: 500 });
        }

        return new Response("ok");
      },
    },
  },
});
