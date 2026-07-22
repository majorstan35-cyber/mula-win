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

        if (signature) {
          const expected = createHmac("sha512", secret).update(raw).digest("hex");
          try {
            const a = Buffer.from(signature, "hex");
            const b = Buffer.from(expected, "hex");
            if (a.length !== b.length || !timingSafeEqual(a, b)) {
              console.warn("[paystack-webhook] Signature mismatch");
              return new Response("Invalid signature", { status: 401 });
            }
          } catch {
            return new Response("Invalid signature", { status: 401 });
          }
        }

        let event: any;
        try {
          event = JSON.parse(raw);
        } catch {
          return new Response("Invalid body", { status: 400 });
        }

        const eventName = event?.event;
        const reference: string | undefined = event?.data?.reference;

        if (!reference) {
          return new Response("ok"); // acknowledge event without reference
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Find payment record by Paystack reference or checkout ID
        const { data: payment } = await supabaseAdmin
          .from("payments")
          .select("id, run_id, user_id, status")
          .eq("mpesa_checkout_request_id", reference)
          .maybeSingle();

        if (!payment) {
          console.log(`[paystack-webhook] Payment reference not found in DB: ${reference}`);
          return new Response("ok"); // Ack anyway so Paystack doesn't retry indefinitely
        }

        // 1. Handle Successful Payments
        if (eventName === "charge.success") {
          if (payment.status === "paid") {
            return new Response("already processed");
          }

          const mpesaReceipt: string | undefined =
            event?.data?.authorization?.receiver_bank_account_number ||
            event?.data?.mobile_money?.receipt ||
            event?.data?.reference;

          await supabaseAdmin
            .from("payments")
            .update({
              status: "paid",
              mpesa_receipt: mpesaReceipt ?? reference,
              raw_callback: event,
            })
            .eq("id", payment.id);

          try {
            const { settleDraw } = await import("@/lib/game.server");
            await settleDraw(payment.run_id!, supabaseAdmin);
            console.log(`[paystack-webhook] Draw settled successfully for run ${payment.run_id}`);
          } catch (err: any) {
            console.error("[paystack-webhook] failed to settle draw:", err.message);
            return new Response("Failed to settle draw", { status: 500 });
          }

          return new Response("ok");
        }

        // 2. Handle Failed Payments
        if (eventName === "charge.failed" || eventName === "invoice.payment_failed") {
          console.log(`[paystack-webhook] Charge failed for reference: ${reference}`);
          await supabaseAdmin
            .from("payments")
            .update({
              status: "failed",
              raw_callback: event,
            })
            .eq("id", payment.id);

          if (payment.run_id) {
            await supabaseAdmin
              .from("runs")
              .update({ status: "failed" })
              .eq("id", payment.run_id);
          }

          return new Response("ok");
        }

        return new Response("ok");
      },
    },
  },
});
