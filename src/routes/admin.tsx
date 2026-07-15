import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminOverview, setJackpotConfig, setUserBlocked } from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fetchOverview = useServerFn(adminOverview);
  const saveConfig = useServerFn(setJackpotConfig);
  const toggleBlock = useServerFn(setUserBlocked);

  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  async function reload() {
    try {
      const d = await fetchOverview();
      setData(d);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    if (user) reload();
  }, [user]);

  if (err) return <main className="p-8"><p className="text-sm text-[color:var(--destructive)]">{err}</p></main>;
  if (!data) return <main className="p-8 text-sm text-[color:var(--muted-foreground)]">Loading…</main>;

  const m = data.metrics;
  const c = data.config;

  async function updateConfig(patch: any) {
    setSaving(true);
    try {
      await saveConfig({ data: patch });
      await reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-8">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm text-[color:var(--muted-foreground)]">← Back</Link>
        <span className="text-xs uppercase tracking-widest text-[color:var(--gold-soft)]">Admin</span>
      </div>
      <h1 className="mt-4 font-display text-3xl font-bold">Mula Admin</h1>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Revenue (KES)" value={m.totalRevenue.toLocaleString()} />
        <Metric label="Payouts (KES)" value={m.totalPayouts.toLocaleString()} />
        <Metric label="Net margin" value={m.netMargin.toLocaleString()} accent />
        <Metric label="Runs" value={String(m.runCount)} />
      </section>

      <section className="mt-8 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/50 p-5">
        <h2 className="font-display text-xl font-bold">Jackpot config</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <ConfigField label="Jackpot KES" value={c.jackpot_amount_kes} onSave={(v) => updateConfig({ jackpot_amount_kes: v })} />
          <ConfigField label="Ticket KES" value={c.ticket_price_kes} onSave={(v) => updateConfig({ ticket_price_kes: v })} />
          <ConfigField label="Pool max" value={c.pool_max} onSave={(v) => updateConfig({ pool_max: v })} />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            disabled={saving}
            onClick={() => updateConfig({ paused: !c.paused })}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${c.paused ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}
          >
            {c.paused ? "Resume draws" : "Pause draws"}
          </button>
          <span className="text-xs text-[color:var(--muted-foreground)]">Status: {c.paused ? "PAUSED" : "LIVE"}</span>
        </div>
        <div className="mt-5">
          <p className="text-xs uppercase tracking-widest text-[color:var(--muted-foreground)]">Prize tiers</p>
          <div className="mt-2 grid grid-cols-2 gap-1 text-xs sm:grid-cols-4">
            {(c.prize_tiers as any[]).map((t) => (
              <div key={t.match} className="rounded-md border border-[color:var(--border)] px-2 py-1">
                Match {t.match} → <span className="text-[color:var(--gold-soft)]">KES {t.prize_kes.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/50 p-5">
        <h2 className="font-display text-xl font-bold">Users</h2>
        <ul className="mt-3 divide-y divide-[color:var(--border)]">
          {data.users.map((u: any) => (
            <li key={u.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <div>{u.display_name ?? u.phone ?? u.id.slice(0, 8)}</div>
                <div className="text-xs text-[color:var(--muted-foreground)]">{new Date(u.created_at).toLocaleDateString()}</div>
              </div>
              <button
                onClick={() => toggleBlock({ data: { userId: u.id, blocked: !u.blocked } }).then(reload)}
                className={`rounded-md px-3 py-1 text-xs ${u.blocked ? "bg-red-500/20 text-red-400" : "bg-[color:var(--muted)]/40"}`}
              >
                {u.blocked ? "Blocked" : "Block"}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/50 p-5">
        <h2 className="font-display text-xl font-bold">Recent runs</h2>
        <ul className="mt-3 divide-y divide-[color:var(--border)] text-sm">
          {data.recentRuns.slice(0, 20).map((r: any) => (
            <li key={r.id} className="flex items-center justify-between py-2">
              <span>{new Date(r.created_at).toLocaleString()}</span>
              <span className="font-mono">{r.matched_count ?? 0}/12</span>
              <span className={r.prize_kes ? "text-[color:var(--gold)]" : "text-[color:var(--muted-foreground)]"}>
                {r.prize_kes ? `+${r.prize_kes.toLocaleString()}` : "—"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]/50 p-4">
      <div className="text-[10px] uppercase tracking-widest text-[color:var(--muted-foreground)]">{label}</div>
      <div className={`mt-1 font-display text-2xl font-bold ${accent ? "text-[color:var(--gold)]" : ""}`}>{value}</div>
    </div>
  );
}

function ConfigField({ label, value, onSave }: { label: string; value: number; onSave: (v: number) => void }) {
  const [v, setV] = useState<string>(String(value));
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-[color:var(--muted-foreground)]">{label}</span>
      <div className="mt-1 flex gap-2">
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          className="w-full rounded-md border border-[color:var(--border)] bg-[color:var(--input)] px-2 py-1 text-sm"
        />
        <button
          onClick={() => onSave(Number(v))}
          className="rounded-md bg-[color:var(--gold)]/20 px-2 text-xs font-semibold text-[color:var(--gold-soft)]"
        >
          Save
        </button>
      </div>
    </label>
  );
}
