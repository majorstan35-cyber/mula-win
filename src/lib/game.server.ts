import crypto from "crypto";

// --------------------------------------------------------------------------
// buildTargetNumbers
// Builds a 12-number target array that guarantees exactly M of the player's
// picks are inside it.  Everything is deterministic from the run ID hash so
// re-polling always returns identical numbers.
// --------------------------------------------------------------------------
function buildTargetNumbers(
  picks: number[],
  M: number,
  poolMin: number,
  poolMax: number,
  hash: string
): number[] {
  // Deterministic PRNG seeded from the run hash
  let seedVal = parseInt(hash.slice(2, 18), 16) >>> 0;
  const nextRand = () => {
    // xorshift32
    seedVal ^= seedVal << 13;
    seedVal ^= seedVal >>> 17;
    seedVal ^= seedVal << 5;
    seedVal = seedVal >>> 0; // keep unsigned
    return seedVal / 0x100000000;
  };

  // Fisher-Yates shuffle (deterministic)
  const fyShuffle = <T>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(nextRand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // Clamp M to valid range
  M = Math.max(0, Math.min(M, picks.length, 12));

  // 1. Pick which M index positions of the player's picks will match
  const indices = Array.from({ length: picks.length }, (_, i) => i);
  const shuffledIndices = fyShuffle(indices);
  const matchedIndices = new Set(shuffledIndices.slice(0, M));

  // 2. Build pool of numbers that are NOT in the player's picks
  const picksSet = new Set(picks);
  const nonPickPool: number[] = [];
  for (let i = poolMin; i <= poolMax; i++) {
    if (!picksSet.has(i)) nonPickPool.push(i);
  }
  const shuffledNonPick = fyShuffle(nonPickPool);

  // 3. Build target array where index i strictly aligns with picks[i]
  const target: number[] = new Array(picks.length);
  let nonPickIdx = 0;

  for (let i = 0; i < picks.length; i++) {
    if (matchedIndices.has(i)) {
      // Matched: place exact pick at index i (10 at slot 0, 20 at slot 1, etc.)
      target[i] = picks[i];
    } else {
      // Miss: place non-pick number at index i
      target[i] = shuffledNonPick[nonPickIdx++];
    }
  }

  return target;
}

// --------------------------------------------------------------------------
// determineOutcome
// Core algorithm:  deterministic roll from run.id decides match count (M)
// and prize based on total system revenue.
// --------------------------------------------------------------------------
function determineOutcome(
  runId: string,
  totalRevenue: number,
  userDrawnCount: number = 0
): { M: number; prize: number } {
  const hash = crypto.createHash("sha256").update(runId).digest("hex");

  // Derive a 0-999999 roll deterministically from the hash
  const roll = parseInt(hash.slice(0, 8), 16) % 1_000_000; // 0 … 999 999

  // ---  BELOW FLOAT THRESHOLD (KES 250,000)  ---
  // No prizes at all. 
  if (totalRevenue < 250_000) {
    const lowRoll = parseInt(hash.slice(8, 10), 16) % 100; // 0-99

    // First spin: 90% chance 8/12, 10% chance 7/12
    if (userDrawnCount === 0) {
      const M = lowRoll < 90 ? 8 : 7;
      return { M, prize: 0 };
    }

    // 2nd spin onwards: realistic variation (6/12, 7/12, or 5/12)
    let M = 6;
    if (lowRoll < 45) {
      M = 6; // 45% -> 6/12
    } else if (lowRoll < 80) {
      M = 7; // 35% -> 7/12
    } else {
      M = 5; // 20% -> 5/12
    }
    return { M, prize: 0 };
  }

  // ---  ABOVE FLOAT THRESHOLD  ---
  // Grand jackpot: only when revenue >= 100 M AND a 1-in-100,000 roll
  if (totalRevenue >= 100_000_000 && roll < 10) {
    return { M: 12, prize: 1_000_000 };
  }

  // 1-in-1,000,000  → 9/12, KES 30,000
  if (roll === 0) {
    return { M: 9, prize: 30_000 };
  }

  // 1-in-500,000   → 9/12, KES 25,000
  if (roll < 2) {
    return { M: 9, prize: 25_000 };
  }

  // 1-in-200,000   → 9/12, KES 20,000
  if (roll < 5) {
    return { M: 9, prize: 20_000 };
  }

  // Default near-miss: 1st spin 8/12, 2nd+ spins varied 6/12, 7/12, 5/12
  const nearRoll = parseInt(hash.slice(10, 12), 16) % 100; // 0-99
  if (userDrawnCount === 0) {
    const M = nearRoll < 90 ? 8 : 7;
    return { M, prize: 0 };
  }

  const M = nearRoll < 45 ? 6 : nearRoll < 80 ? 7 : 5;
  return { M, prize: 0 };
}

// --------------------------------------------------------------------------
// settleDraw  (exported – called from webhook + polling fallback)
// --------------------------------------------------------------------------
export async function settleDraw(
  runId: string,
  supabaseAdmin: any
): Promise<{ run: any; target: number[]; seedHash: string; roundNumber: number }> {

  // 1. Fetch run
  const { data: run, error: runErr } = await supabaseAdmin
    .from("runs")
    .select("id, user_id, round_id, player_numbers, status, created_at")
    .eq("id", runId)
    .maybeSingle();

  if (runErr || !run) throw new Error(runErr?.message || "Run not found");

  // Already settled – return current state (idempotent)
  if (run.status === "drawn") {
    const { data: round } = await supabaseAdmin
      .from("rounds")
      .select("id, target_numbers, seed_hash, round_number")
      .eq("id", run.round_id)
      .maybeSingle();

    const { data: config } = await supabaseAdmin
      .from("jackpot_config")
      .select("pool_min, pool_max")
      .eq("active", true)
      .maybeSingle();

    const poolMin = config?.pool_min ?? 1;
    const poolMax = config?.pool_max ?? 40;
    const targetNumbers = getTargetNumbersForRun(run, round?.target_numbers ?? [], 0, poolMin, poolMax);

    return {
      run,
      target: targetNumbers,
      seedHash: round?.seed_hash || "hash_secured",
      roundNumber: round?.round_number ?? 1,
    };
  }

  // 2. Fetch round
  const { data: round, error: roundErr } = await supabaseAdmin
    .from("rounds")
    .select("id, target_numbers, seed_hash, round_number")
    .eq("id", run.round_id)
    .maybeSingle();

  if (roundErr || !round) throw new Error(roundErr?.message || "Round not found");

  // 3. Fetch pool config
  const { data: config } = await supabaseAdmin
    .from("jackpot_config")
    .select("pool_min, pool_max")
    .eq("active", true)
    .maybeSingle();

  const poolMin: number = config?.pool_min ?? 1;
  const poolMax: number = config?.pool_max ?? 40;

  // 4. Calculate total system revenue (sum of all paid payments)
  const { data: revenueRows } = await supabaseAdmin
    .from("payments")
    .select("amount_kes")
    .eq("status", "paid");

  const totalRevenue: number = (revenueRows ?? []).reduce(
    (sum: number, p: { amount_kes: number }) => sum + (p.amount_kes ?? 0),
    0
  );

  // Calculate completed runs for this user before this one
  const { count } = await supabaseAdmin
    .from("runs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", run.user_id)
    .eq("status", "drawn")
    .lt("created_at", run.created_at);

  const userDrawnCount: number = count ?? 0;

  // 5. Determine match count M and prize using float-controlled algorithm
  const { M, prize } = determineOutcome(runId, totalRevenue, userDrawnCount);

  // 6. Build target numbers that guarantee exactly M of the player's picks match
  const picks: number[] = run.player_numbers || [];
  const hash = crypto.createHash("sha256").update(runId).digest("hex");
  const targetNumbers = buildTargetNumbers(picks, M, poolMin, poolMax, hash);

  // 7. Verify actual match count (safety check)
  const targetSet = new Set(targetNumbers);
  const actualMatched = picks.filter((n: number) => targetSet.has(n)).length;

  // 8. Persist results
  const { data: updatedRun, error: updateErr } = await supabaseAdmin
    .from("runs")
    .update({
      status: "drawn",
      matched_count: actualMatched,
      prize_kes: prize,
      drawn_at: new Date().toISOString(),
    })
    .eq("id", run.id)
    .select("*")
    .single();

  if (updateErr || !updatedRun) {
    throw new Error(updateErr?.message || "Failed to update run status");
  }

  console.log(
    `[settleDraw] run=${runId} revenue=KES${totalRevenue} M=${M} matched=${actualMatched} prize=KES${prize}`
  );

  return {
    run: updatedRun,
    target: targetNumbers,
    seedHash: round.seed_hash,
    roundNumber: round.round_number,
  };
}

// --------------------------------------------------------------------------
// getTargetNumbersForRun  (exported – used by getRunStatus for display)
// When the run is already drawn, reconstruct the same target numbers from
// the stored matched_count so the UI animation is consistent.
// --------------------------------------------------------------------------
export function getTargetNumbersForRun(
  run: { id: string; user_id: string; player_numbers: number[]; matched_count?: number },
  roundTargetNumbers: number[],
  _prevDrawnCount: number, // kept for API compatibility, no longer used
  poolMin: number,
  poolMax: number
): number[] {
  const hash = crypto.createHash("sha256").update(run.id).digest("hex");
  const M = run.matched_count ?? 8; // use what was stored
  return buildTargetNumbers(run.player_numbers || [], M, poolMin, poolMax, hash);
}
