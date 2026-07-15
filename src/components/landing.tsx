import { useEffect, useMemo, useState, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";

const TARGET_NUMBERS = [10, 20, 27, 1, 36, 5, 13, 39, 38, 12, 16, 25];

// Set next draw ~ end of today (mock)
function useCountdown(target: Date) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!now) return { h: 0, m: 0, s: 0, ready: false };
  const diff = Math.max(0, target.getTime() - now.getTime());
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return { h, m, s, ready: true };
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function maskPhone(p: string) {
  return p.replace(/(\d{4})\d{4}(\d{2})/, "$1****$2");
}

const SOCIAL_PROOF = [
  { phone: "0712345678", matched: 9, city: "Nairobi", ago: "12s ago" },
  { phone: "0733112244", matched: 7, city: "Mombasa", ago: "34s ago" },
  { phone: "0798000111", matched: 10, city: "Kisumu", ago: "1m ago" },
  { phone: "0721556677", matched: 8, city: "Nakuru", ago: "2m ago" },
  { phone: "0740998877", matched: 11, city: "Eldoret", ago: "3m ago" },
  { phone: "0715334422", matched: 6, city: "Thika", ago: "4m ago" },
];

export function Landing() {
  const { user, signOut } = useAuth();
  const jackpot = 1_000_000;

  const nextDrawTarget = useMemo(() => {
    const t = new Date();
    t.setHours(21, 0, 0, 0);
    if (t.getTime() < Date.now()) t.setDate(t.getDate() + 1);
    return t;
  }, []);
  const { h, m, s, ready } = useCountdown(nextDrawTarget);

  const [slide, setSlide] = useState(0);
  const [onlineCount, setOnlineCount] = useState(() => Math.floor(1100 + Math.random() * 400));
  const trendRef = useRef(1);

  useEffect(() => {
    const id = setInterval(() => {
      setSlide((v) => (v + 1) % SOCIAL_PROOF.length);
      setOnlineCount((n) => {
        if (Math.random() < 0.05) {
          trendRef.current *= -1;
        }
        if (n <= 920) trendRef.current = 1;
        if (n >= 2280) trendRef.current = -1;
        const delta = (Math.floor(Math.random() * 15) + 5) * trendRef.current;
        const newVal = n + delta;
        return Math.max(900, Math.min(2300, newVal));
      });
    }, 3200);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Ambient gold glow */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-60"
        style={{
          background:
            "radial-gradient(ellipse at 50% -10%, oklch(0.82 0.16 85 / 0.28), transparent 60%)",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-5 pb-24 pt-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gold-gradient flex h-8 w-8 items-center justify-center rounded-full font-display text-lg font-black text-[oklch(0.14_0.01_60)] shadow-gold-soft">
              M
            </div>
            <span className="font-display text-xl font-bold tracking-tight">Mula</span>
          </div>
          {user ? (
            <div className="flex items-center gap-2">
              <Link to="/history" className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]">History</Link>
              <button onClick={signOut} className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]">Sign out</button>
            </div>
          ) : (
            <Link to="/auth" className="rounded-full border border-[color:var(--border)] px-4 py-1.5 text-xs font-medium text-[color:var(--muted-foreground)] transition hover:text-[color:var(--foreground)]">
              Sign in
            </Link>
          )}
        </header>

        {/* Jackpot */}
        <section className="mt-10 text-center animate-slide-up">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-[color:var(--muted-foreground)] animate-pulse">
            Grand Award
          </p>
          <div className="mt-4">
            <div className="font-display text-6xl font-black leading-none text-shimmer sm:text-7xl">
              KES {jackpot.toLocaleString()}
            </div>
            <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">
              Match all 12 numbers. One winner takes it all.
            </p>
          </div>


        </section>

        {/* Target numbers */}
        <section className="mt-10 animate-slide-up" style={{ animationDelay: "80ms" }}>
          <p className="mb-3 text-center text-xs font-medium uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
            The 12 Numbers to Match
          </p>
          <div className="grid grid-cols-6 gap-2">
            {TARGET_NUMBERS.map((n, i) => (
              <div
                key={n}
                className="animate-number-flip aspect-square"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="relative flex h-full w-full items-center justify-center rounded-xl border border-[color:var(--gold)]/30 bg-gradient-to-br from-[oklch(0.22_0.025_75)] to-[oklch(0.14_0.01_60)] font-display text-xl font-bold text-[color:var(--gold-soft)] shadow-gold-soft">
                  {n}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Play button */}
        <section className="mt-10 animate-slide-up" style={{ animationDelay: "160ms" }}>
          <Link
            to={user ? "/play" : "/auth"}
            className="animate-gold-pulse bg-gold-gradient shadow-gold block w-full rounded-2xl py-5 text-center font-display text-2xl font-black tracking-tight text-[oklch(0.12_0.01_60)] transition active:scale-[0.98]"
          >
            Tap to Play
          </Link>
          <p className="mt-3 text-center text-xs text-[color:var(--muted-foreground)]">
            You'll receive an M-Pesa prompt on your phone.
          </p>
        </section>

        {/* Trust row replaced with flowing animated bar */}
        <section className="mt-8 animate-slide-up" style={{ animationDelay: "240ms" }}>
          <div className="relative overflow-hidden rounded-xl border border-[color:var(--gold)]/40 bg-[color:var(--card)]/60 py-4 text-center shadow-[0_0_15px_rgba(var(--gold-rgb, 180,140,60),0.15)]">
            {/* Sweeping background light effect */}
            <div className="absolute inset-0 z-0 animate-casino-scan bg-gradient-to-r from-transparent via-[color:var(--gold)]/20 to-transparent" />
            
            <p className="relative z-10 font-display text-sm font-bold tracking-widest text-[color:var(--gold-soft)] animate-light-flicker">
              WIN AND RECEIVE INSTANT PAYMENT
            </p>
          </div>
        </section>

        {/* Live activity */}
        <section className="mt-8 animate-slide-up" style={{ animationDelay: "320ms" }}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
              Live Activity
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-[color:var(--muted-foreground)]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              {onlineCount.toLocaleString()} playing now
            </span>
          </div>

          <div className="relative h-20 overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/50 backdrop-blur">
            {SOCIAL_PROOF.map((item, i) => {
              const active = i === slide;
              return (
                <div
                  key={i}
                  className="absolute inset-0 flex items-center justify-between px-4 transition-all duration-500"
                  style={{
                    opacity: active ? 1 : 0,
                    transform: `translateY(${active ? 0 : 8}px)`,
                  }}
                >
                  <div>
                    <div className="text-sm font-semibold text-[color:var(--foreground)]">
                      {maskPhone(item.phone)}
                    </div>
                    <div className="text-xs text-[color:var(--muted-foreground)]">
                      {item.city} · {item.ago}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-2xl font-bold text-[color:var(--gold)]">
                      {item.matched}
                      <span className="text-sm text-[color:var(--muted-foreground)]">/12</span>
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-[color:var(--muted-foreground)]">
                      matched
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex justify-center gap-1.5">
            {SOCIAL_PROOF.map((_, i) => (
              <span
                key={i}
                className="h-1 rounded-full bg-[color:var(--muted-foreground)]/30 transition-all"
                style={{
                  width: i === slide ? 18 : 6,
                  background:
                    i === slide ? "var(--gold)" : undefined,
                }}
              />
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="mt-10 animate-slide-up" style={{ animationDelay: "400ms" }}>
          <p className="mb-3 text-center text-xs font-medium uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
            How it works
          </p>
          <ol className="space-y-2">
            {[
              "Click \"Tap to Play\"",
              "Confirm the M-Pesa prompt on your phone",
              "Watch your 12 numbers reveal live",
              "Match all 12 — win KES 1,000,000",
            ].map((step, i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]/40 px-4 py-3"
              >
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full border border-[color:var(--gold)]/40 font-display text-sm font-bold text-[color:var(--gold)]">
                  {i + 1}
                </span>
                <span className="text-sm text-[color:var(--foreground)]/90">{step}</span>
              </li>
            ))}
          </ol>
        </section>


      </div>
    </main>
  );
}
