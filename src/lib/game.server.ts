import crypto from "crypto";

export function getTargetNumbersForRun(
  run: { id: string; user_id: string; player_numbers: number[] },
  roundTargetNumbers: number[],
  countBeforeThisRun: number,
  poolMin: number,
  poolMax: number
): number[] {
  if (countBeforeThisRun >= 3) {
    return roundTargetNumbers;
  }

  // Deterministic seed based on run.id to ensure the same run always generates the same target numbers
  const hash = crypto.createHash("sha256").update(run.id).digest("hex");
  
  // Decide M (match count) based on countBeforeThisRun (0, 1, 2)
  let M = 9;
  if (countBeforeThisRun === 0) {
    // 1st run: match 9 or 10
    M = (parseInt(hash.slice(0, 2), 16) % 2) === 0 ? 9 : 10;
  } else if (countBeforeThisRun === 1) {
    // 2nd run: match 10 or 11
    M = (parseInt(hash.slice(0, 2), 16) % 2) === 0 ? 10 : 11;
  } else {
    // 3rd run: match 8 or 9
    M = (parseInt(hash.slice(0, 2), 16) % 2) === 0 ? 8 : 9;
  }

  const picks = run.player_numbers || [];
  
  // Generate deterministic shuffle of picks using the hash
  const picksList = [...picks];
  let seedVal = parseInt(hash.slice(2, 10), 16);
  const nextRand = () => {
    seedVal = (seedVal * 9301 + 49297) % 233280;
    return seedVal / 233280;
  };

  // Fisher-Yates shuffle picks deterministically
  for (let i = picksList.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand() * (i + 1));
    [picksList[i], picksList[j]] = [picksList[j], picksList[i]];
  }

  const matchingNumbers = picksList.slice(0, M);

  // Collect all non-picks pool numbers
  const nonPicksPool: number[] = [];
  const picksSet = new Set(picks);
  for (let i = poolMin; i <= poolMax; i++) {
    if (!picksSet.has(i)) {
      nonPicksPool.push(i);
    }
  }

  // Shuffle the non-picks pool deterministically
  for (let i = nonPicksPool.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand() * (i + 1));
    [nonPicksPool[i], nonPicksPool[j]] = [nonPicksPool[j], nonPicksPool[i]];
  }

  const nonMatchingNumbers = nonPicksPool.slice(0, 12 - M);

  // Combine and shuffle the target numbers deterministically
  const combined = [...matchingNumbers, ...nonMatchingNumbers];
  for (let i = combined.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand() * (i + 1));
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }

  return combined;
}

export async function settleDraw(
  runId: string,
  supabaseAdmin: any
): Promise<{ run: any; target: number[]; seedHash: string; roundNumber: number }> {
  // 1. Fetch run details
  const { data: run, error: runErr } = await supabaseAdmin
    .from("runs")
    .select("id, user_id, round_id, player_numbers, status, created_at")
    .eq("id", runId)
    .maybeSingle();

  if (runErr || !run) {
    throw new Error(runErr?.message || "Run not found");
  }

  // 2. Fetch round details
  const { data: round, error: roundErr } = await supabaseAdmin
    .from("rounds")
    .select("id, target_numbers, seed_hash, round_number")
    .eq("id", run.round_id)
    .maybeSingle();

  if (roundErr || !round) {
    throw new Error(roundErr?.message || "Round not found");
  }

  // 3. Fetch active config
  const { data: config } = await supabaseAdmin
    .from("jackpot_config")
    .select("pool_min, pool_max, numbers_per_draw, prize_tiers")
    .eq("active", true)
    .maybeSingle();

  const poolMin = config?.pool_min ?? 1;
  const poolMax = config?.pool_max ?? 90;

  // 4. Count user's completed runs before this one
  const { count, error: countErr } = await supabaseAdmin
    .from("runs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", run.user_id)
    .eq("status", "drawn")
    .lt("created_at", run.created_at);

  if (countErr) {
    console.error("[settleDraw] error counting previous runs:", countErr.message);
  }

  const prevDrawnCount = count ?? 0;

  // 5. Generate final target numbers
  const targetNumbers = getTargetNumbersForRun(
    run,
    round.target_numbers,
    prevDrawnCount,
    poolMin,
    poolMax
  );

  // 6. Score matching count
  const picks = run.player_numbers || [];
  const targetSet = new Set(targetNumbers);
  const matched = picks.filter((n: number) => targetSet.has(n)).length;

  // 7. Calculate prize
  const tiers = config?.prize_tiers || [];
  const tier = (tiers as { match: number; prize_kes: number }[])
    .filter((t) => matched >= t.match)
    .sort((a, b) => b.match - a.match)[0];
  const prize = tier?.prize_kes ?? 0;

  // 8. Update run to drawn
  const { data: updatedRun, error: updateErr } = await supabaseAdmin
    .from("runs")
    .update({
      status: "drawn",
      matched_count: matched,
      prize_kes: prize,
      drawn_at: new Date().toISOString(),
    })
    .eq("id", run.id)
    .select("*")
    .single();

  if (updateErr || !updatedRun) {
    throw new Error(updateErr?.message || "Failed to update run status");
  }

  return {
    run: updatedRun,
    target: targetNumbers,
    seedHash: round.seed_hash,
    roundNumber: round.round_number,
  };
}
