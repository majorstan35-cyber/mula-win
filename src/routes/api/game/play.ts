import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/game/play")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabase } = await import("@/lib/db.server");
        const { verifyAuthToken, json } = await import("@/lib/auth.server");

        const decoded = await verifyAuthToken(request);
        if (!decoded) return json({ message: "Unauthorized" }, 401);

        let body: any;
        try {
          body = await request.json();
        } catch {
          return json({ message: "Invalid request body" }, 400);
        }

        const { picks, phone } = body;
        const userId = decoded.sub;

        try {
          // 1. Get active config
          const { data: configRows } = await supabase
            .from('jackpot_config')
            .select('*')
            .eq('active', true)
            .limit(1);

          const config = configRows && configRows.length > 0 ? configRows[0] : null;
          if (!config) return json({ message: "No active config" }, 404);
          if (config.paused) return json({ message: "Draws are currently paused" }, 400);

          // 2. Check profile block
          const { data: profileRows } = await supabase
            .from('profiles')
            .select('blocked, phone')
            .eq('id', userId)
            .maybeSingle();

          const profile = profileRows;
          if (profile?.blocked) return json({ message: "Account blocked" }, 403);

          // 3. Get current open round
          const { data: roundRows } = await supabase
            .from('rounds')
            .select('*')
            .eq('status', 'open')
            .order('round_number', { ascending: false })
            .limit(1);

          const round = roundRows && roundRows.length > 0 ? roundRows[0] : null;
          if (!round) return json({ message: "No open round" }, 404);

          // 4. Validate picks
          const need = config.numbers_per_draw;
          if (!Array.isArray(picks) || picks.length !== need) {
            return json({ message: `Pick exactly ${need} numbers` }, 400);
          }
          const unique = new Set(picks);
          if (unique.size !== picks.length) {
            return json({ message: "Numbers must be unique" }, 400);
          }
          for (const n of picks) {
            if (!Number.isInteger(n) || n < config.pool_min || n > config.pool_max) {
              return json({ message: `Numbers must be between ${config.pool_min} and ${config.pool_max}` }, 400);
            }
          }

          // 5. Insert run (pending)
          const { data: runRows } = await supabase
            .from('runs')
            .insert({ user_id: userId, round_id: round.id, status: 'pending' })
            .select('*')
            .single();

          const run = runRows;

          // 6. Insert payment (auto-PAID for now; Paystack webhook marks real payments)
          const finalPhone = phone || profile?.phone || "254000000000";
          await supabase
            .from('payments')
            .insert({
              user_id: userId,
              run_id: run.id,
              amount_kes: config.ticket_price_kes,
              phone: finalPhone,
              status: 'paid',
              mpesa_receipt: "DEMO-" + run.id.slice(0, 8).toUpperCase()
            });

          // 7. Process draw
          const targetSet = new Set<number>(round.target_numbers);
          const matched = (picks as number[]).filter((n) => targetSet.has(n)).length;
          const tiers = config.prize_tiers || [];
          const tier = (tiers as { match: number; prize_kes: number }[])
            .filter((t) => matched >= t.match)
            .sort((a, b) => b.match - a.match)[0];
          const prize = tier?.prize_kes ?? 0;

          // 8. Update run to drawn
          const { data: updatedRunRows } = await supabase
            .from('runs')
            .update({
              status: 'drawn',
              player_numbers: picks,
              matched_count: matched,
              prize_kes: prize,
              drawn_at: new Date().toISOString()
            })
            .eq('id', run.id)
            .select('*')
            .single();

          return json({
            run: updatedRunRows,
            target: round.target_numbers,
            seedHash: round.seed_hash,
            roundNumber: round.round_number,
          });
        } catch (err: any) {
          console.error("[api/game/play] error:", err.message);
          return json({ message: err.message }, 500);
        }
      },
    },
  },
});