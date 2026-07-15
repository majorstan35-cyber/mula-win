import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/api-docs")({
  head: () => ({
    meta: [
      { title: "Mula API — Swagger-style reference" },
      { name: "description", content: "Backend endpoints powering Mula spins, payments, and admin." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ApiDocsPage,
});

type Ep = {
  method: "GET" | "POST";
  path: string;
  auth: "public" | "user" | "admin" | "webhook";
  desc: string;
  req?: string;
  res?: string;
};

const GROUPS: { title: string; endpoints: Ep[] }[] = [
  {
    title: "Game (public + user)",
    endpoints: [
      {
        method: "GET",
        path: "/_serverFn/getPublicState",
        auth: "public",
        desc: "Active jackpot config + current open round with seed_hash commit (provably-fair).",
        res: "{ config: JackpotConfig, round: { id, round_number, seed_hash, target_numbers[], status } }",
      },
      {
        method: "POST",
        path: "/_serverFn/playNow",
        auth: "user",
        desc: "Create a run for the current round, generate 12 player numbers deterministically from (server_seed | user_id | run_id), score against target, apply tiered prize.",
        req: "{ phone?: string }",
        res: "{ run, target[], seedHash, roundNumber }",
      },
      {
        method: "GET",
        path: "/_serverFn/getMyHistory",
        auth: "user",
        desc: "Last 50 runs for the current player (matched_count, prize_kes, drawn_at).",
        res: "Run[]",
      },
    ],
  },
  {
    title: "Payments — Paystack",
    endpoints: [
      {
        method: "POST",
        path: "/_serverFn/paystackInitialize",
        auth: "user",
        desc: "Create pending run, call Paystack /transaction/initialize (KES 200 kobo), return authorization_url + reference.",
        req: "{ email: string }",
        res: "{ authorization_url, reference, run_id }",
      },
      {
        method: "POST",
        path: "/api/public/paystack/webhook",
        auth: "webhook",
        desc: "Paystack callback. Verify HMAC-SHA512 with PAYSTACK_SECRET_KEY, mark payment paid, trigger draw, finalise run.",
        req: "{ event: 'charge.success', data: { reference, amount, ... } }",
        res: "200 ok",
      },
      {
        method: "GET",
        path: "/_serverFn/verifyPayment",
        auth: "user",
        desc: "Poll a run by reference after redirect from Paystack; returns finalised run when webhook has completed.",
        req: "{ reference: string }",
        res: "{ status, run? }",
      },
    ],
  },
  {
    title: "Payments — Flutterwave",
    endpoints: [
      {
        method: "POST",
        path: "/_serverFn/flutterwaveInitialize",
        auth: "user",
        desc: "Create pending run, call Flutterwave /payments (KES 200), return payment link + tx_ref.",
        req: "{ email: string, phone?: string }",
        res: "{ link, tx_ref, run_id }",
      },
      {
        method: "POST",
        path: "/api/public/flutterwave/webhook",
        auth: "webhook",
        desc: "Flutterwave callback. Verify verif-hash header against FLW_SECRET_HASH, verify transaction via GET /transactions/:id/verify, mark paid, run draw.",
        res: "200 ok",
      },
    ],
  },
  {
    title: "Auth",
    endpoints: [
      {
        method: "POST",
        path: "supabase.auth.signUp",
        auth: "public",
        desc: "Email + password sign-up (phone stored in profiles).",
      },
      {
        method: "POST",
        path: "supabase.auth.signInWithPassword",
        auth: "public",
        desc: "Sign in.",
      },
      {
        method: "POST",
        path: "supabase.auth.signOut",
        auth: "user",
        desc: "Sign out.",
      },
    ],
  },
  {
    title: "Admin",
    endpoints: [
      {
        method: "GET",
        path: "/_serverFn/adminOverview",
        auth: "admin",
        desc: "Revenue, payouts, net margin, run count, win rate, recent runs, users, config.",
        res: "{ metrics, recentRuns[], users[], config }",
      },
      {
        method: "POST",
        path: "/_serverFn/setJackpotConfig",
        auth: "admin",
        desc: "Update jackpot amount, ticket price, pool range, prize tiers, or pause/resume draws.",
        req: "{ jackpot_amount_kes?, ticket_price_kes?, pool_min?, pool_max?, numbers_per_draw?, paused?, prize_tiers? }",
      },
      {
        method: "POST",
        path: "/_serverFn/setUserBlocked",
        auth: "admin",
        desc: "Block or unblock a player.",
        req: "{ userId: string, blocked: boolean }",
      },
    ],
  },
];

function ApiDocsPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <Link to="/" className="text-sm text-[color:var(--muted-foreground)]">← Back</Link>
      <h1 className="mt-4 font-display text-4xl font-black">API reference</h1>
      <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
        Backend surface for Mula — server functions (RPC over HTTPS) + public webhooks. RLS enforced via Supabase.
      </p>

      <div className="mt-8 space-y-8">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h2 className="font-display text-xl font-bold text-[color:var(--gold-soft)]">{g.title}</h2>
            <ul className="mt-3 space-y-3">
              {g.endpoints.map((e) => (
                <li key={e.path + e.method} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]/60 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-bold ${
                      e.method === "GET" ? "bg-emerald-500/15 text-emerald-400" : "bg-sky-500/15 text-sky-400"
                    }`}>{e.method}</span>
                    <code className="font-mono text-sm text-[color:var(--foreground)]">{e.path}</code>
                    <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                      e.auth === "public" ? "bg-[color:var(--muted)]/40 text-[color:var(--muted-foreground)]"
                      : e.auth === "user" ? "bg-[color:var(--gold)]/15 text-[color:var(--gold-soft)]"
                      : e.auth === "admin" ? "bg-red-500/15 text-red-400"
                      : "bg-purple-500/15 text-purple-300"
                    }`}>{e.auth}</span>
                  </div>
                  <p className="mt-2 text-sm text-[color:var(--foreground)]/85">{e.desc}</p>
                  {e.req && <p className="mt-2 font-mono text-[11px] text-[color:var(--muted-foreground)]">req: {e.req}</p>}
                  {e.res && <p className="mt-1 font-mono text-[11px] text-[color:var(--muted-foreground)]">res: {e.res}</p>}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <footer className="mt-12 border-t border-[color:var(--border)] pt-6 text-xs text-[color:var(--muted-foreground)]">
        <p>Secrets needed for live payments: <code>PAYSTACK_SECRET_KEY</code>, <code>FLW_SECRET_KEY</code>, <code>FLW_SECRET_HASH</code>.</p>
        <p className="mt-1">All state-changing endpoints use Zod validation and Supabase RLS. Webhooks verify provider signatures before touching the DB.</p>
      </footer>
    </main>
  );
}
