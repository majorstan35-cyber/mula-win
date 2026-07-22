import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPublicState } from "@/lib/draw.functions";
import { initiateMpesaCharge, getRunStatus } from "@/lib/paystack.functions";
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

// ─── Comments split by prize tier — text MUST match badge shown ──────────────
const WINNING_MESSAGES_20K = [
  "Ero omera! 20k landed straight on Mpesa, sijui kucheza tena 😭🙌",
  "Buda si unajua? Alert ya 20,000 imetoka hata sijapumzika 😂📱",
  "Ngai fafa! Wambui ameambia ukweli, 20k imefika sasa hivi 🙏💸",
  "Khayekha! Omwami wangu 20,000 iko safe Mpesa yangu 💪🥳",
  "Mombasa tunaendelea! Alert ya elfu ishirini imeingia 🌊💰",
  "Chesire! Iten hii ni real, 20k credited leo asubuhi 🏃🔥",
  "Unadhani ni mchezo? 9 out of 12 na 20,000 confirmed! Machakos power 🇰🇪",
  "Ndugu yangu nimefurahi sana, 20k kutoka kwa mula win 😭🎉",
  "Hii pesa saa hii imenisaidia sana, 20,000 intact Mpesa 🙌✨",
  "Ebu niambie kama hii si real, alert 20k imeingia right now 😱📲",
  "Onyinkwa! Kisii power, 20,000 credited bila stress! 🎊💃",
  "Wuod Kisumu represent! 20k straight kwa simu yangu 🔥🎉",
  "Wewe nakuambia hii kitu inafanya kazi, 20,000 iko kwa akaunti 💸🏆",
  "Nilidhani ni mchezo mpaka 20k ilipoingia, Embu represent! 😂🎉",
  "Poa sana! Elfu ishirini zimeingia bila kusumbua 🍀💰",
  "Sawa kabisa! Mpesa alert ya 20k, Nanyuki tunaendelea 🥳🚀",
  "Aaaah nimeshindwa kuamini, 20,000 credited straight hapo! 😭🙏",
  "Naweza sema ukweli? Hii app ni legit, 20k imefika Meru 🎯💸",
  "Kibet aliambia ukweli, Eldoret tunawin, 20,000 alert! 🏃💨",
  "Baba wa nyumba amenipata 20k bila kutoka nje, Kitale represent 🏠💸",
  "Nakuru simu imepiga, 20,000 confirmed! Tunaendelea tena 🎊🔥",
  "Oooh Ngai! Njeri alisema 20k, kweli kweli iko Mpesa 🙌💎",
  "Garissa tunaendelea! 20,000 alert imeingia saa hii hii 🔥💸",
  "Lakini hii app kweli kweli inabeba, 20k credited Kilifi 🌴💰",
  "Simu inapiga vibration ya Mpesa, 20,000 iko hapa Malindi 📳💸",
  "Eeeh mungu wangu, nilikuwa naona tu, 20k imeingia Bungoma! 😭🎉",
  "Auma yangu wa Siaya, 20k credited no jokes 🎉🙌",
  "Spin moja na 20k straight, Ruiru boys tunaendelea 💪🔥",
  "Wakinywa chai Kericho, mimi niko na 20k Mpesa tayari 🍵😂",
];

const WINNING_MESSAGES_25K = [
  "Omwabo sana! 25,000 credited, Nyamira power imethibitishwa 🤑💃",
  "Manze buda, simu imepiga 25k, Thika boys tuko juu 📱🔥",
  "Chebet akipiga kelele Eldoret, 25,000 iko Mpesa sasa 🏃💨🥳",
  "Ngai fafa Wanjiku, 25k credited bila delay! Kiambu represent 🙌💰",
  "Ebu angalia hii, 25,000 Mpesa alert Webuye power! 🎉💸",
  "Otieno wa Kisumu, 25k straight to Mpesa, no stress 🎊🔥",
  "Nakuru chai na 25,000 kwa mfukoni saa hii 😂🍵💸",
  "Umenisimamisha! 10 out of 12 na 25k, Karatina represent 🏆✨",
  "Hata sikuamini mpaka nikaona Mpesa, 25,000 iko safe 😱💰",
  "Kericho tea land tena! 25k alert, Kibet ataambia wote 🍵💸",
  "Kipchoge speed ya akili, 25,000 credited bila kusita 🏃🥇",
  "Moraa yangu, Kisii watu wanawin 25k bila stress 💃🤑",
  "Mombasa raha, 25k imeingia saa hii, Mpesa inanikubaliana 🌊💸",
  "Hii ni kweli, 25,000 imetoka kwa Mula Win, Embu represent 🎉💪",
  "Sijui kucheka ama kulilia, 25k credited Meru right now 😭😂",
  "Simu yangu inalia na furaha, 25,000 alert imetoka Garissa 📳💸",
  "Machakos power! Mwende amesema 25k iko kwa akaunti leo 🇰🇪🥳",
  "Buda nimekuambia hii kitu ni legit, 25k imethibitishwa Ruiru 💯🔥",
  "Hallelujah! Elfu ishirini na tano Mpesa, Kitale inawin 🙏💰",
  "Naivasha vibes, 25,000 alert imeingia wakati wa mapumziko 🌿💸",
  "Eeeh mimi Adhiambo wa Homa Bay, 25k credited bila mchezo 😭🎉",
  "10 numbers matched, 25,000 saa hii hii Nanyuki represent 🏔️💸",
  "Watu wa Bungoma, 25k imethibitishwa. Hii si mchezo! 💪🎊",
  "Unanikashifu? 25k landed, Kilifi beach player tuko juu 🌊🤑",
  "Simama hapo, 25,000 credited kweli kweli! Nyeri power 🏆✨",
  "Sawa kabisa! Simu imelia na 25k, Malindi represent 📲🔥",
  "Omwami wa Kakamega, 25,000 straight Mpesa, bora uhai 💪💸",
  "Aaah Njeri amelala vizuri leo, 25k iko kwa simu 😂🙌",
  "Siaya represent! Achieng amesema 25,000 no lies, iko safe 🎉💎",
  "Hata nilipigia mama simu, 25k credited Nakuru! 😭🙏",
];

const WINNING_MESSAGES_50K = [
  "EEEEEH! 50,000 credited, Wairimu wa Kiambu hataamini! 💎🚀😭",
  "Omwabo wa miaka yote! 50k Siaya, Wuod Baba ameshinda leo! 🎊🥇",
  "11 numbers matched... sitaki kulilia, 50,000 iko MPESA SASA 😭💎",
  "Kayole boys tuko juu! 50k bana, dunia ni yetu leo usiku! 💸👑",
  "Omwabo! Kisii county, 50,000 saa hii ndio kwanza ninaamini 🎊💎",
  "Aaaah nimeshindwa! 11/12 na 50k straight, Eldoret power forever 🏃🥇",
  "Mama yangu atalilia, 50,000 credited Homa Bay. Ero omera! 😭🎉",
  "Hata sikuamini, spin moja, 50k Mpesa Mombasa inaendelea! 🌊💎",
  "Kibet alikuwa anasema nikimbie, nimekata nikashinda 50k! 😂🏆",
  "Nakuru mtu wa kawaida, 50,000 leo sitaenda kazi kesho 😂💸",
  "Njeri amepigia wote simu, 50k confirmed Nyeri! Ngai fafa! 🙌🥳",
  "Buda najua unaona, 50k real, Thika West represent! 💪🔥",
  "Omwami wa Kakamega, elfu hamsini straight kwa Mpesa! 🥰💎",
  "Mwende wa Machakos analia machozi ya furaha, 50k iko safe 😭🎉",
  "11 out of 12! Bado napigia simu friends, 50k credited sasa 📞💸",
  "Watu wa Kisumu, Auma ameshinda 50,000. Hata sikuamini! 😱🏆",
  "Hii ndiyo nguvu ya Mula Win, 50k Mpesa Embu right now! 🏆🔥",
  "Adhiambo wa Siaya amesema 50k iko, na mimi naona alert! 😭🎊",
  "Ruiru Eastlands champion, 50,000 credited bila kuwaza sana 💯💎",
  "Kiambu power, Wanjiku amesema ukweli. 50k iko Mpesa saa hii 🙌💸",
  "Lakini hii game, 50k straight credited, Bungoma represent! 😱🥳",
  "Otieno alikataa kuspin, mimi nikaspin, 50k iko safe Kisumu 😂🏆",
  "Kilifi beach winner, 50,000 wakati jua likichomeka 🌊😎💎",
  "Hata nafikiri ni ndoto, 50k Mpesa saa hii. Nanyuki power! 😭🔥",
  "11 matched! Mpesa inalia, 50k confirmed, Garissa represent! 📳💸",
  "Mtu wa Nakuru, 50,000 saa hii, sitaambia bosi kesho 😂💎",
  "Eeeh Chesire wa Iten, umeshinda 50k, mbio za Leo hazina maana 🏃🥇💸",
];

const NONWIN_POOL = [
  "Missed by 3 but iko karibu, spinning again saa hii 🔁",
  "Warm up tu buda, next one ni yangu 💪",
  "Acha niskie pumzi, returning in 2 mins 😤",
  "Bahati mbaya leo lakini kesho ni siku yangu 🙏",
  "Ulikuwa karibu sana, one more spin! 🎯",
  "Warm up spin done. Mbele tuna sherehe 🚀",
  "Nimeamua nitakuwa winner leo usiku 🌙💸",
  "Chapaa inakuja, trust the process 🤞",
  "Almost! 8 matched, next spin niko tayari 💥",
  "Hii mara next nitashinda, najua numbers zangu 😎",
  "Nimeweka ngumi, next spin ni jackpot 🥊🎰",
  "Wueh, bahati mbaya lakini siachi 😭🔥",
  "Nairobi boys hawaachi, spinning again 🔄",
  "One more try, feeling lucky leo 🍀",
  "Hizi numbers zinanikaribia, one more spin! 😅",
  "Poleni wenzangu, next one ni yangu 💯",
  "7 out of 12, getting warmer! 🔥",
  "Sitaisha leo, target ni 20k minimum 💸",
  "Harakisha, spinning again right now! ⚡",
  "Practise spin, next one ni serious 🎯",
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Shuffled pools — randomized per session, no repeating cycle
const _pool20 = shuffle(WINNING_MESSAGES_20K);
const _pool25 = shuffle(WINNING_MESSAGES_25K);
const _pool50 = shuffle(WINNING_MESSAGES_50K);
const _poolNW = shuffle(NONWIN_POOL);
let _i20 = 0, _i25 = 0, _i50 = 0, _iNW = 0;

function generateOrganicMessage(matched: number): string {
  if (matched === 11) {
    return _pool50[(_i50++) % _pool50.length];
  }
  if (matched === 10) {
    return _pool25[(_i25++) % _pool25.length];
  }
  if (matched === 9) {
    return _pool20[(_i20++) % _pool20.length];
  }
  return _poolNW[(_iNW++) % _poolNW.length];
}

type FeedItem = { id: number; tag: string; city: string; matched: number; secondsAgo: number; msg: string; prizeKes?: number };

function randomFeedItem(id: number, secondsAgo = 0): FeedItem {
  const rand = Math.random();
  let matched = 5;
  let prizeKes: number | undefined = undefined;

  // Win ratio: ~35% of entries win prizes (9/12, 10/12, 11/12)
  if (rand < 0.20) matched = 4;
  else if (rand < 0.40) matched = 5;
  else if (rand < 0.55) matched = 6;
  else if (rand < 0.65) matched = 7;
  else if (rand < 0.75) matched = 8;
  else if (rand < 0.90) { matched = 9; prizeKes = 20000; }
  else if (rand < 0.97) { matched = 10; prizeKes = 25000; }
  else { matched = 11; prizeKes = 50000; }

  return {
    id,
    tag: `Player #${Math.floor(1000 + Math.random() * 8999)}`,
    city: CITIES[Math.floor(Math.random() * CITIES.length)],
    matched,
    secondsAgo,
    prizeKes,
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

function PlayPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const startCharge = useServerFn(initiateMpesaCharge);
  const pollRun = useServerFn(getRunStatus);
  const runState = useServerFn(getPublicState);

  const [poolMin, setPoolMin] = useState(1);
  const [poolMax, setPoolMax] = useState(40);
  const [need, setNeed] = useState(12);
  const [picks, setPicks] = useState<number[]>([10, 20, 27, 1, 36, 5, 13, 39, 38, 12, 16, 25]);
  const [running, setRunning] = useState(false);
  const [reveal, setReveal] = useState<number[]>([]);
  const [result, setResult] = useState<Result | null>(null);

  const [feed, setFeed] = useState<FeedItem[]>(() =>
    Array.from({ length: 8 }, (_, i) => randomFeedItem(i, i * 15 + Math.floor(Math.random() * 20))),
  );
  const [online, setOnline] = useState(() => Math.floor(1100 + Math.random() * 400));
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
        // Randomly flip trend with 5% probability
        if (Math.random() < 0.05) {
          trendRef.current *= -1;
        }
        // Force trend flip if boundaries are hit
        if (n <= 920) trendRef.current = 1;
        if (n >= 2280) trendRef.current = -1;

        // Change by a sequential step
        const delta = (Math.floor(Math.random() * 15) + 5) * trendRef.current;
        const newVal = n + delta;
        return Math.max(900, Math.min(2300, newVal));
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
      .catch(() => { });
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
      .catch(() => { });
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
    setPicks([]);
    setReveal([]);
    setResult(null);
    setErr(null);
    setRunId(null);
    setStkMsg("");
    if (pollTimer.current) clearInterval(pollTimer.current);
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
      setStkMsg(res.displayText);
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
        if (s.runStatus === "drawn" && s.run && s.target && s.seedHash && s.roundNumber !== null) {
          if (pollTimer.current) clearInterval(pollTimer.current);
          setPayOpen(false);
          setPayStep(null);

          // Align matched numbers to their exact position in 'picks'
          const alignedTarget = new Array(need).fill(undefined);
          const nonMatched: number[] = [];
          for (const num of s.target) {
            const idx = picks.indexOf(num as number);
            if (idx !== -1) {
              alignedTarget[idx] = num;
            } else {
              nonMatched.push(num as number);
            }
          }
          for (let i = 0; i < alignedTarget.length; i++) {
            if (alignedTarget[i] === undefined) {
              alignedTarget[i] = nonMatched.shift();
            }
          }

          await animateReveal({
            run: {
              id: s.run.id,
              player_numbers: s.run.player_numbers,
              matched_count: s.run.matched_count ?? 0,
              prize_kes: s.run.prize_kes ?? 0,
            },
            target: alignedTarget,
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
                  className={`flex aspect-square items-center justify-center rounded-xl font-display text-lg font-bold transition-all duration-300 ${isMatched
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
          className={`relative overflow-hidden rounded-2xl border p-4 transition-all duration-700 ${running
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
                    className="flex aspect-square items-center justify-center rounded-xl"
                  >
                    <div
                      className={running ? "animate-casino-dot h-3.5 w-3.5 rounded-full" : "h-3.5 w-3.5 rounded-full bg-[color:var(--border)]/50 animate-pulse"}
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
                  className={`flex aspect-square items-center justify-center rounded-xl font-display text-lg font-bold animate-number-flip transition-all duration-300 ${isMatch
                    ? "border-2 border-[color:var(--gold)] bg-gold-gradient text-[oklch(0.14_0.01_60)] shadow-gold scale-105 animate-light-flicker"
                    : "border border-[color:var(--border)]/60 bg-[color:var(--card)] text-[color:var(--foreground)]/60"
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
        <button
          onClick={resetForNextSpin}
          className="bg-gold-gradient shadow-gold mt-6 w-full rounded-2xl py-5 font-display text-2xl font-black text-[oklch(0.12_0.01_60)]"
        >
          Play again
        </button>
      ) : (
        <button
          onClick={openPay}
          disabled={running || !ready}
          className={`mt-6 w-full rounded-2xl py-5 font-display text-2xl font-black transition ${ready && !running
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
              className={`flex items-center justify-between rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]/50 px-3 py-2.5 text-sm transition-all ${i === 0 ? "animate-slide-up border-[color:var(--gold)]/40" : ""
                }`}
            >
              <div>
                <div className="font-semibold">{f.tag}</div>
                <div className="text-xs text-[color:var(--muted-foreground)]">
                  {f.city} · {formatAgo(f.secondsAgo)} · <span className="italic">"{f.msg}"</span>
                </div>
              </div>
              <div className="text-right flex flex-col items-end">
                <div className="font-display text-xl font-bold text-[color:var(--gold)]">
                  {f.matched}<span className="text-xs text-[color:var(--muted-foreground)]">/{need}</span>
                </div>
                {f.prizeKes ? (
                  <div className="mt-1 flex items-center gap-1 rounded-full border border-emerald-500/60 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)] animate-pulse">
                    <span>🎉</span>
                    <span>+ KES {f.prizeKes.toLocaleString()}</span>
                  </div>
                ) : null}
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

