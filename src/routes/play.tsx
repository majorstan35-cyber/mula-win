import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPublicState } from "@/lib/draw.functions";
import { initiateMpesaCharge, getRunStatus, submitUserComment } from "@/lib/paystack.functions";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";


export const Route = createFileRoute("/play")({
  component: PlayPage,
});

type Result = {
  run: { id: string; player_numbers: number[]; matched_count: number; prize_kes: number };
  target: number[];
  seedHash: string;
  roundNumber: number;
};

const CITIES = [
  "Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Thika", "Nyeri", "Kakamega",
  "Embu", "Meru", "Machakos", "Kitale", "Kericho", "Malindi", "Kilifi", "Naivasha",
  "Kisii", "Bungoma", "Garissa", "Isiolo", "Voi", "Lamu", "Diani", "Karatina",
  "Ruiru", "Kiambu", "Athi River", "Nanyuki", "Kajiado", "Migori", "Homa Bay", "Busia",
];

function generateOrganicMessage(matched: number): string {
  if (matched === 9) {
    const phrases = [
      "Acoro! 20k inside M-Pesa 🥳",
      "Omera 20k drop kwa M-Pesa! 🔥",
      "won KES 20,000 after 5 spins! 💸",
      "Kai! Nimepata 9/12 mara ya 4 🍀",
      "Ero kamano! 9/12 matched 🥳",
      "chapaa imeingia M-Pesa 20,000! 🚀",
      "nimepata 9/12 kwa spin ya 4 🔥",
      "finally 9/12 on 3rd try today ✨",
      "Wira ni wira, 20k inside! 💸",
      "Adier 20,000 cash out! 🍀",
      "M-Pesa 20,000 payment received 💸",
      "manze stay guided, 20k confirmed! 🔥"
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
  }

  if (matched === 10) {
    const phrases = [
      "Ngai fafa 30k imeingia M-Pesa! 🥳",
      "wueh 10/12 payout received! 🔥",
      "Omera 30,000 cash out! 💸",
      "matched 10/12! 30k in the bank 🚀",
      "missed 1M by only 2 numbers, got 30k! 🍀",
      "Kai 30k confirmed kwa spin ya 6! 🥳",
      "M-Pesa alert: KES 30,000 credited ✨"
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
  }

  if (matched === 11) {
    const phrases = [
      "so close to 1M! Got KES 50,000 payout 🔥",
      "Ngai! 50k received via M-Pesa! 🥳",
      "Ber ahinya! 50,000 on 8th spin 🚀",
      "M-Pesa alert KES 50,000 confirmed! 💸"
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
  }

  if (matched >= 12) {
    return "🏆 GRAND JACKPOT WINNER! KES 1,000,000! 👑";
  }

  // Non-winning natural organic messages with Kikuyu, Luo, Sheng & English
  if (matched === 8) {
    const phrases = [
      "ayaya missed by 2 numbers 😭",
      "Acoro 8 matched, so close 🤞",
      "Omera so close, 8/12 today 🔥",
      "almost got 9/12, 8 matched 🍀",
      "2nd try today, 8/12 matched",
      "Kai! Remained with 4 only 😤",
      "warm up spin done, 8 matched ✨"
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
  }

  if (matched === 7 || matched === 6) {
    const phrases = [
      "getting closer 🚀",
      "3rd attempt today got 7/12 🤞",
      "feeling lucky, let me spin again 🍀",
      "Wi muogi, 7/12 today 🔥",
      "ber ahinya, next spin loading ✨",
      "chapaa inakuja soon, 6 matched",
      "not bad, let's keep pushing 💸",
      "one more spin manze 👊"
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
  }

  // 4 or 5 matched
  const phrases = [
    "we try again omera 🤞",
    "bahati mbaya, next one 🔥",
    "Acoro process continues ✨",
    "ah just missed it 😭",
    "nakuja tena kwa spin 🚀",
    "playing again now 🍀"
  ];
  return phrases[Math.floor(Math.random() * phrases.length)];
}

type FeedItem = { id: number; tag: string; city: string; matched: number; secondsAgo: number; msg: string };

function randomFeedItem(id: number, secondsAgo = 0, forceWin?: number): FeedItem {
  let matched = 5;

  if (forceWin !== undefined) {
    matched = forceWin;
  } else {
    // Realistic win ratio (~18%-22% wins = 4 winners per ~20 comments)
    const rand = Math.random();
    if (rand < 0.24) matched = 4;
    else if (rand < 0.50) matched = 5;
    else if (rand < 0.68) matched = 6;
    else if (rand < 0.78) matched = 7;
    else if (rand < 0.82) matched = 8;
    else if (rand < 0.94) matched = 9;   // 12% chance 9/12 (KES 20,000)
    else if (rand < 0.99) matched = 10;  // 5% chance 10/12 (KES 30,000)
    else matched = 11;                    // 1% chance 11/12 (KES 50,000)
  }

  return {
    id,
    tag: `Player #${Math.floor(1000 + Math.random() * 8999)}`,
    city: CITIES[Math.floor(Math.random() * CITIES.length)],
    matched,
    secondsAgo,
    msg: generateOrganicMessage(matched),
  };
}

function formatAgo(s: number) {
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function getTargetOnlineRange(): { min: number; max: number } {
  const currentHour = new Date().getHours();
  // Past midnight (00:00 to 05:59): around 700 online
  if (currentHour >= 0 && currentHour < 6) {
    return { min: 620, max: 820 };
  }
  // Daytime (06:00 to 23:59): 1000 to 2000 online
  return { min: 1050, max: 1980 };
}

function PlayPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const startCharge = useServerFn(initiateMpesaCharge);
  const pollRun = useServerFn(getRunStatus);
  const runState = useServerFn(getPublicState);
  const postComment = useServerFn(submitUserComment);

  const [poolMin, setPoolMin] = useState(1);
  const [poolMax, setPoolMax] = useState(40);
  const [need, setNeed] = useState(12);
  const [picks, setPicks] = useState<number[]>([10, 20, 27, 1, 36, 5, 13, 39, 38, 12, 16, 25]);
  const [running, setRunning] = useState(false);
  const [reveal, setReveal] = useState<number[]>([]);
  const [result, setResult] = useState<Result | null>(null);

  const [commentText, setCommentText] = useState("");
  const [commentSent, setCommentSent] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  const [feed, setFeed] = useState<FeedItem[]>(() =>
    Array.from({ length: 8 }, (_, i) => randomFeedItem(i, i * 15 + Math.floor(Math.random() * 20))),
  );
  const [online, setOnline] = useState(() => {
    const { min, max } = getTargetOnlineRange();
    return Math.floor(min + Math.random() * (max - min));
  });
  const trendRef = useRef(1); // 1 for up, -1 for down

  useEffect(() => {
    let nextId = 1000;
    const tick = () => {
      setFeed((prev) => {
        const aged = prev.map((f) => ({ ...f, secondsAgo: f.secondsAgo + 4 }));
        const item = randomFeedItem(nextId++, 0);
        return [item, ...aged].slice(0, 8);
      });
      setOnline((n) => {
        const { min, max } = getTargetOnlineRange();
        // Randomly flip trend with 5% probability
        if (Math.random() < 0.05) {
          trendRef.current *= -1;
        }
        // Force trend flip if boundaries are hit
        if (n <= min + 15) trendRef.current = 1;
        if (n >= max - 15) trendRef.current = -1;

        // Change by a sequential step
        const delta = (Math.floor(Math.random() * 12) + 3) * trendRef.current;
        const newVal = n + delta;
        return Math.max(min, Math.min(max, newVal));
      });
    };
    const id = setInterval(tick, 3500);
    return () => clearInterval(id);
  }, []);

  const [err, setErr] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payStep, setPayStep] = useState<"phone" | "stk" | null>(null);
  const [phone, setPhone] = useState("");
  const [phoneLoaded, setPhoneLoaded] = useState(false);
  const [stkMsg, setStkMsg] = useState<string>("");
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pre-fill phone from user profile
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("phone")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.phone && !phoneLoaded) {
          setPhone(data.phone);
          setPhoneLoaded(true);
        }
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    runState()
      .then((s) => {
        setPoolMin(s.config.pool_min);
        setPoolMax(s.config.pool_max);
        setNeed(s.config.numbers_per_draw);
      })
      .catch(() => {});
  }, [runState]);

  // Removed random generation so picks remain statically locked in.

  useEffect(() => () => {
    if (pollTimer.current) clearInterval(pollTimer.current);
  }, []);

  const pool = useMemo(() => {
    const arr: number[] = [];
    for (let i = poolMin; i <= poolMax; i++) arr.push(i);
    let seed = poolMin * 1000 + poolMax;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [poolMin, poolMax]);

  const pickSet = useMemo(() => new Set(picks), [picks]);
  const revealSet = useMemo(() => new Set(reveal), [reveal]);
  const ready = picks.length === need;

  function togglePick(n: number) {
    if (running || result) return;
    setPicks((prev) => {
      if (prev.includes(n)) return prev.filter((x) => x !== n);
      if (prev.length >= need) return prev;
      return [...prev, n];
    });
  }

  function quickPick() {
    if (running || result) return;
    const set = new Set<number>();
    while (set.size < need) set.add(poolMin + Math.floor(Math.random() * (poolMax - poolMin + 1)));
    setPicks(Array.from(set));
  }

  function clearPicks() {
    if (running || result) return;
    setPicks([]);
  }

  function resetForNextSpin() {
    // Restore static default lucky numbers starting with 10
    setPicks([10, 20, 27, 1, 36, 5, 13, 39, 38, 12, 16, 25]);

    setReveal([]);
    setResult(null);
    setErr(null);
    setRunId(null);
    setRunning(false);
    setPayOpen(false);
    setPayStep(null);
    setStkMsg("");
    setCommentText("");
    setCommentSent(false);
    setSubmittingComment(false);
    if (pollTimer.current) clearInterval(pollTimer.current);
  }

  function playAgainAndPay() {
    resetForNextSpin();
    setPayStep("phone");
    setPayOpen(true);
  }

  async function handleCommentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim() || submittingComment) return;
    setSubmittingComment(true);
    try {
      await postComment({ data: { runId: result?.run.id, commentText } });
      setCommentSent(true);
    } catch (err: any) {
      setErr(err.message ?? "Could not post comment");
    } finally {
      setSubmittingComment(false);
    }
  }

  function openPay() {
    if (!ready) {
      setErr(`Pick ${need - picks.length} more number${need - picks.length === 1 ? "" : "s"}`);
      return;
    }
    setErr(null);
    setPayStep("phone");
    setPayOpen(true);
  }

  async function submitPhone() {
    // Validate phone before sending
    const digits = phone.replace(/\D/g, "");
    let normalized = digits;
    if (normalized.startsWith("0")) normalized = "254" + normalized.slice(1);
    else if (normalized.startsWith("7") || normalized.startsWith("1")) normalized = "254" + normalized;
    else if (normalized.startsWith("254")) { /* ok */ }
    else {
      setErr("Enter a valid Kenyan M-Pesa number (e.g. 0712 345 678)");
      return;
    }
    if (normalized.length !== 12) {
      setErr("Phone number must be 12 digits (e.g. 0712 345 678)");
      return;
    }
    setErr(null);
    setStkMsg("");
    setRunning(true);
    try {
      const res = await startCharge({ data: { picks, phone } });
      setRunId(res.runId);
      setStkMsg(res.displayText || "Please complete the M-Pesa PIN prompt on your phone.");
      setPayStep("stk");
      startPolling(res.runId);
    } catch (e: any) {
      setErr(e.message ?? "Could not start payment");
      setRunning(false);
    }
  }

  function startPolling(id: string) {
    let elapsed = 0;
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(async () => {
      elapsed += 3;
      try {
        const s = await pollRun({ data: { runId: id } });
        if (s.runStatus === "drawn" && s.run && Array.isArray(s.target) && s.target.length > 0) {
          if (pollTimer.current) clearInterval(pollTimer.current);
          setPayOpen(false);
          setPayStep(null);
          
          await animateReveal({
            run: {
              id: s.run.id,
              player_numbers: s.run.player_numbers,
              matched_count: s.run.matched_count ?? 0,
              prize_kes: s.run.prize_kes ?? 0,
            },
            target: s.target,
            seedHash: s.seedHash,
            roundNumber: s.roundNumber,
          });
        } else if (s.runStatus === "failed") {
          if (pollTimer.current) clearInterval(pollTimer.current);
          setErr("Payment failed or was cancelled");
          setRunning(false);
          setPayStep("phone");
        } else if (elapsed > 180) {
          if (pollTimer.current) clearInterval(pollTimer.current);
          setErr("Timed out waiting for M-Pesa confirmation");
          setRunning(false);
          setPayStep("phone");
        }
      } catch (e) {
        // keep polling
      }
    }, 3000);
  }

  async function animateReveal(r: Result) {
    setReveal([]);
    for (let i = 0; i < r.target.length; i++) {
      await new Promise((res) => setTimeout(res, 320));
      setReveal((prev) => [...prev, r.target[i]]);
    }
    await new Promise((res) => setTimeout(res, 400));
    setResult(r);
    setRunning(false);
  }


  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm text-[color:var(--muted-foreground)]">← Back</Link>
        <Link to="/history" className="text-sm text-[color:var(--gold-soft)]">History</Link>
      </div>

      <h1 className="mt-6 font-display text-3xl font-bold">SPIN & WIN</h1>
      <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
        Match all {need} to win KES 1,000,000.
      </p>

      {/* TOP: Static Lucky Numbers Ticket */}
      <section className="mt-8 animate-slide-up">
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--gold-soft)]">
            Your Lucky Numbers
          </p>
          <span className="text-[10px] text-[color:var(--muted-foreground)]">Locked in</span>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-[color:var(--gold)]/30 bg-[color:var(--card)] p-4 shadow-gold-soft">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[color:var(--gold)]/5 to-transparent opacity-50" />
          <div className="relative z-10 grid grid-cols-6 gap-2.5">
            {picks.map((n, i) => {
              const isMatched = result && (result.target as number[]).includes(n);
              return (
                <div
                  key={i}
                  className={`flex aspect-square items-center justify-center rounded-xl font-display text-lg font-bold transition-all duration-300 ${
                    isMatched
                      ? "border-2 border-[color:var(--gold)] bg-gold-gradient text-[oklch(0.14_0.01_60)] shadow-gold scale-105"
                      : result
                      ? "border border-[color:var(--border)] bg-[color:var(--card)]/40 text-[color:var(--muted-foreground)] opacity-50"
                      : "border border-[color:var(--gold)]/50 bg-[color:var(--background)] text-[color:var(--gold-soft)] shadow-inner"
                  }`}
                >
                  {n}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* BOTTOM: Spin Result Grid - casino light vibe */}
      <section className="mt-5">
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--muted-foreground)]">
            {result ? "Draw Result" : running ? "Spinning…" : "Spin Result"}
          </p>
          {running && (
            <span className="flex items-center gap-1.5 text-[10px] text-[color:var(--gold)]">
              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-[color:var(--gold)]" />
              Drawing
            </span>
          )}
        </div>

        {/* Casino light card with glowing border */}
        <div
          className={`relative overflow-hidden rounded-2xl border p-4 transition-all duration-700 ${
            running
              ? "animate-casino-border border-[color:var(--gold)]/60 bg-[color:var(--card)]"
              : result
              ? "border-[color:var(--gold)]/40 bg-[color:var(--card)]/80"
              : "border-[color:var(--border)]/40 bg-[color:var(--card)]/50"
          }`}
        >
          {/* Scanner sweep line - only while spinning */}
          {running && (
            <div
              className="absolute inset-y-0 w-20 pointer-events-none z-20 animate-casino-scan"
              style={{
                background: "linear-gradient(90deg, transparent 0%, oklch(0.85 0.18 85 / 30%) 50%, transparent 100%)",
              }}
            />
          )}

          {/* Corner sparkle dots - decorative lights */}
          {(running || result) && [
            "top-2 left-2", "top-2 right-2", "bottom-2 left-2", "bottom-2 right-2",
          ].map((pos, ci) => (
            <span
              key={ci}
              className="absolute h-1.5 w-1.5 rounded-full bg-[color:var(--gold)] animate-light-flicker"
              style={{ animationDelay: `${ci * 200}ms`, top: pos.includes("top") ? "8px" : undefined, bottom: pos.includes("bottom") ? "8px" : undefined, left: pos.includes("left") ? "8px" : undefined, right: pos.includes("right") ? "8px" : undefined }}
            />
          ))}

          <div className="relative z-10 grid grid-cols-6 gap-2.5">
            {Array.from({ length: need }).map((_, i) => {
              const drawnNum = reveal[i];
              const isMatch = drawnNum !== undefined && picks.includes(drawnNum);
              const isRevealed = drawnNum !== undefined;

              if (!isRevealed) {
                return (
                  <div
                    key={i}
                    className={`flex aspect-square items-center justify-center rounded-xl border transition-all duration-300 ${
                      running
                        ? "border-[color:var(--gold)]/30 bg-[color:var(--background)]"
                        : "border-[color:var(--border)]/40 bg-[color:var(--card)]/30"
                    }`}
                  >
                    <div
                      className={running ? "animate-casino-dot h-3 w-3 rounded-full" : "h-2.5 w-2.5 rounded-full bg-[color:var(--border)]/40 animate-pulse"}
                      style={{
                        animationDelay: `${i * 100}ms`,
                        background: running
                          ? `radial-gradient(circle, oklch(0.88 0.2 85) 0%, oklch(0.65 0.15 75) 100%)`
                          : undefined,
                      }}
                    />
                  </div>
                );
              }

              return (
                <div
                  key={i}
                  className={`flex aspect-square items-center justify-center rounded-xl font-display text-lg font-bold animate-number-flip transition-all duration-300 ${
                    isMatch
                      ? "border-2 border-[color:var(--gold)] bg-gold-gradient text-[oklch(0.14_0.01_60)] shadow-gold scale-105 animate-light-flicker"
                      : "border border-[color:var(--border)] bg-[color:var(--card)]/40 text-[color:var(--muted-foreground)] opacity-50"
                  }`}
                >
                  {drawnNum}
                </div>
              );
            })}
          </div>


          {!result && !running && (
            <div className="mt-4 flex flex-col items-center justify-center space-y-1 py-1">
              <span className="text-[9px] uppercase tracking-widest text-[color:var(--gold-soft)]/70 animate-pulse">
                Ready for Spin
              </span>
              <p className="text-[9px] text-[color:var(--muted-foreground)]/50 tracking-wide">
                Numbers will appear here after your spin
              </p>
            </div>
          )}
        </div>
      </section>

      {result && (
        <section className="mt-6 rounded-2xl border border-[color:var(--gold)]/30 bg-[color:var(--card)]/60 p-5 text-center animate-slide-up">
          <div className="text-xs uppercase tracking-widest text-[color:var(--muted-foreground)]">Round #{result.roundNumber}</div>
          <div className="mt-2 font-display text-4xl font-black text-shimmer">
            {result.run.matched_count}/{need} matched
          </div>
          {result.run.prize_kes > 0 ? (
            <div className="mt-3 font-display text-2xl font-bold text-[color:var(--gold)]">
              You won KES {result.run.prize_kes.toLocaleString()}
            </div>
          ) : (
            <div className="mt-3 text-sm text-[color:var(--muted-foreground)]">No prize this spin. Try again.</div>
          )}
          <div className="mt-4 break-all font-mono text-[10px] text-[color:var(--muted-foreground)]">
            Commit: {result.seedHash.slice(0, 24)}…
          </div>
        </section>
      )}

      {err && <div className="mt-4 rounded-lg border border-[color:var(--destructive)]/40 bg-[color:var(--destructive)]/10 px-3 py-2 text-xs text-[color:var(--destructive)]">{err}</div>}

      {result ? (
        <>
          <button
            onClick={playAgainAndPay}
            className="bg-gold-gradient shadow-gold mt-6 w-full rounded-2xl py-5 font-display text-2xl font-black text-[oklch(0.12_0.01_60)]"
          >
            Play again
          </button>

          {/* Post-spin Comment Section */}
          <div className="mt-5 animate-slide-up rounded-2xl border border-[color:var(--gold)]/30 bg-[color:var(--card)]/60 p-4 shadow-gold-soft">
            <h3 className="font-display text-sm font-bold text-[color:var(--gold-soft)] flex items-center gap-1.5">
              <span>💬</span> Leave a Reaction / Comment
            </h3>
            <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
              How was your spin? Share your feedback with us below.
            </p>

            {commentSent ? (
              <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-center text-xs font-semibold text-emerald-400">
                ✨ Thank you! Your comment has been submitted.
              </div>
            ) : (
              <form onSubmit={handleCommentSubmit} className="mt-3 space-y-2">
                <textarea
                  rows={2}
                  placeholder="Type your comment or reaction..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  maxLength={300}
                  className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/40 p-3 font-sans text-xs outline-none focus:border-[color:var(--gold)] resize-none"
                />
                <button
                  type="submit"
                  disabled={submittingComment || !commentText.trim()}
                  className="w-full rounded-xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 py-2.5 font-display text-xs font-bold text-[color:var(--gold-soft)] hover:bg-[color:var(--gold)]/20 disabled:opacity-50 transition active:scale-98"
                >
                  {submittingComment ? "Posting comment…" : "Post Comment"}
                </button>
              </form>
            )}
          </div>
        </>
      ) : (
        <button
          onClick={openPay}
          disabled={running || !ready}
          className={`mt-6 w-full rounded-2xl py-5 font-display text-2xl font-black transition ${
            ready && !running
              ? "animate-gold-pulse bg-gold-gradient shadow-gold text-[oklch(0.12_0.01_60)]"
              : "bg-[color:var(--card)] text-[color:var(--muted-foreground)] border border-[color:var(--border)]"
          }`}
        >
          {running ? "Drawing…" : "SPIN & WIN — KES 200"}
        </button>
      )}



      {/* Live feed */}
      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">Live spins</span>
          <span className="flex items-center gap-1.5 text-[10px] text-[color:var(--muted-foreground)]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            {online.toLocaleString()} online
          </span>
        </div>
        <ul className="space-y-2">
          {feed.map((f, i) => (
            <li
              key={f.id}
              className={`flex items-center justify-between rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]/50 px-3 py-2.5 text-sm transition-all ${
                i === 0 ? "animate-slide-up border-[color:var(--gold)]/40" : ""
              }`}
            >
              <div>
                <div className="font-semibold">{f.tag}</div>
                <div className="text-xs text-[color:var(--muted-foreground)]">
                  {f.city} · {formatAgo(f.secondsAgo)} · <span className="italic">"{f.msg}"</span>
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-xl font-bold text-[color:var(--gold)]">
                  {f.matched}<span className="text-xs text-[color:var(--muted-foreground)]">/{need}</span>
                </div>
                {f.matched === 9 && <div className="text-[10px] font-bold text-emerald-400">+ KES 20,000</div>}
                {f.matched === 10 && <div className="text-[10px] font-bold text-emerald-400">+ KES 30,000</div>}
                {f.matched === 11 && <div className="text-[10px] font-bold text-emerald-400">+ KES 50,000</div>}
                {f.matched >= 12 && <div className="text-[10px] font-bold text-amber-300">+ KES 1,000,000</div>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* M-Pesa payment modal */}
      {payOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-t-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-gold sm:rounded-3xl animate-slide-up">
            {payStep === "phone" && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-xl font-bold">Pay KES 200 via M-Pesa</h2>
                  <button
                    onClick={() => {
                      setPayOpen(false);
                      setRunning(false);
                    }}
                    disabled={running}
                    className="text-sm text-[color:var(--muted-foreground)] disabled:opacity-40"
                  >
                    Cancel
                  </button>
                </div>
                <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                  Enter the M-Pesa number to receive the STK prompt.
                </p>

                <label className="mt-5 block text-xs uppercase tracking-widest text-[color:var(--muted-foreground)]">
                  M-Pesa phone number
                </label>
                <div className="relative mt-2">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-display text-lg text-[color:var(--muted-foreground)] select-none">
                    🇰🇪
                  </span>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoFocus
                    placeholder="0712 345 678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !running) submitPhone(); }}
                    disabled={running}
                    className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/40 pl-12 pr-4 py-3 font-display text-lg tracking-wide outline-none focus:border-[color:var(--gold)] disabled:opacity-60"
                  />
                </div>
                <p className="mt-1 text-[10px] text-[color:var(--muted-foreground)]">
                  Formats accepted: 07XX XXX XXX, 01XX XXX XXX, or +254XXXXXXXXX
                </p>

                <button
                  onClick={submitPhone}
                  disabled={running || phone.replace(/\D/g, "").length < 9}
                  className="mt-5 w-full rounded-2xl bg-gold-gradient py-4 font-display text-xl font-black text-[oklch(0.12_0.01_60)] shadow-gold disabled:opacity-50 transition active:scale-95"
                >
                  {running ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                      Sending STK push…
                    </span>
                  ) : (
                    "📱 Send M-Pesa Prompt"
                  )}
                </button>


              </>
            )}
            {payStep === "stk" && (
              <div className="py-6 text-center">
                <div className="mx-auto h-14 w-14 animate-spin rounded-full border-2 border-[color:var(--gold)] border-t-transparent" />
                <p className="mt-5 font-display text-xl font-bold">Check your phone 📱</p>
                <p className="mt-2 px-2 text-sm text-[color:var(--muted-foreground)]">
                  {stkMsg || "Enter your M-Pesa PIN to confirm KES 200."}
                </p>
                <p className="mt-1 text-xs font-semibold text-[color:var(--gold)]">Sent to: {phone}</p>
                <p className="mt-4 text-[10px] text-[color:var(--muted-foreground)]">
                  Waiting for M-Pesa confirmation… spinning automatically once paid.
                </p>
                <button
                  onClick={() => {
                    if (pollTimer.current) clearInterval(pollTimer.current);
                    setPayStep("phone");
                    setRunning(false);
                    setErr(null);
                  }}
                  className="mt-5 text-xs text-[color:var(--muted-foreground)] underline"
                >
                  Didn't receive it? Try again
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

