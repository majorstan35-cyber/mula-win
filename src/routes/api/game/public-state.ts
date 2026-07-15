import { createFileRoute } from "@tanstack/react-router";
import crypto from "crypto";

function sha256Sync(input: string): Uint8Array {
  return crypto.createHash("sha256").update(input).digest() as unknown as Uint8Array;
}

function pickNumbersSync(bytes: Uint8Array, min: number, max: number, count: number): number[] {
  const size = max - min + 1;
  const picked = new Set<number>();
  const out: number[] = [];
  let i = 0;
  while (out.length < count && i < bytes.length - 3) {
    const v = ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0;
    const n = min + (v % size);
    if (!picked.has(n)) { picked.add(n); out.push(n); }
    i += 4;
  }
  return out;
}

function pickNumbers(seed: string, min: number, max: number, count: number): number[] {
  let bytes = sha256Sync(seed);
  const need = count * 8;
  while (bytes.length < need) {
    const more = sha256Sync(seed + ":" + bytes.length);
    const merged = new Uint8Array(bytes.length + more.length);
    merged.set(bytes);
    merged.set(more, bytes.length);
    bytes = merged;
  }
  return pickNumbersSync(bytes, min, max, count);
}

export const Route = createFileRoute("/api/game/public-state")({
  server: {
    handlers: {
      GET: async () => {
        const { supabase } = await import("@/lib/db.server");
        const { json } = await import("@/lib/auth.server");

        try {
          const { data: configRows } = await supabase
            .from('jackpot_config')
            .select('*')
            .eq('active', true)
            .limit(1);

          const config = configRows && configRows.length > 0 ? configRows[0] : null;
          if (!config) {
            return json({ message: "No active jackpot config" }, 404);
          }

          const { data: roundRows } = await supabase
            .from('rounds')
            .select('id, round_number, seed_hash, target_numbers, status, opened_at')
            .eq('status', 'open')
            .order('round_number', { ascending: false })
            .limit(1);

          let round = roundRows && roundRows.length > 0 ? roundRows[0] : null;

          if (!round) {
            const seed = crypto.randomUUID() + "-" + crypto.randomUUID();
            const seedHash = crypto.createHash("sha256").update(seed).digest("hex");
            const target = pickNumbers(seed, config.pool_min, config.pool_max, config.numbers_per_draw);

            const { data: lastRoundRows } = await supabase
              .from('rounds')
              .select('round_number')
              .order('round_number', { ascending: false })
              .limit(1);

            const nextRoundNumber = (lastRoundRows && lastRoundRows.length > 0 ? lastRoundRows[0].round_number : 0) + 1;

            const { data: createdRoundRows } = await supabase
              .from('rounds')
              .insert({
                round_number: nextRoundNumber,
                server_seed: seed,
                seed_hash: seedHash,
                target_numbers: target,
                status: 'open'
              })
              .select('id, round_number, seed_hash, target_numbers, status, opened_at')
              .single();

            round = createdRoundRows;
          }

          return json({ config, round });
        } catch (err: any) {
          console.error("[api/game/public-state] error:", err.message);
          return json({ message: err.message }, 500);
        }
      },
    },
  },
});