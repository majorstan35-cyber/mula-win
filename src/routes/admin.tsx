import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminOverview, setJackpotConfig, setUserBlocked, markPaymentFailed } from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

type Tab = "overview" | "payments" | "failed" | "runs" | "users" | "comments" | "audit";

function AdminPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fetchOverview = useServerFn(adminOverview);
  const saveConfig = useServerFn(setJackpotConfig);
  const toggleBlock = useServerFn(setUserBlocked);
  const forceFailPayment = useServerFn(markPaymentFailed);

  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  async function reload() {
    try {
      setErr(null);
      const d = await fetchOverview();
      setData(d);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    if (user) reload();
  }, [user]);

  if (err) return (
    <main className="p-8">
      <p className="text-sm text-red-400 mb-3">{err}</p>
      <button onClick={reload} className="rounded-lg bg-white/10 px-4 py-2 text-sm">Retry</button>
    </main>
  );
  if (!data) return <main className="p-8 text-sm text-[color:var(--muted-foreground)]">Loading admin dashboard…</main>;

  const m = data.metrics;
  const c = data.config;

  async function updateConfig(patch: any) {
    setSaving(true);
    try { await saveConfig({ data: patch }); await reload(); }
    catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "payments", label: "✅ Paid", count: data.payments.paid.length },
    { id: "failed", label: "❌ Failed", count: data.payments.failed.length + data.payments.cancelled.length },
    { id: "runs", label: "🎰 Runs", count: data.recentRuns.length },
    { id: "users", label: "👥 Users", count: data.users.length },
    { id: "comments", label: "💬 Comments", count: data.comments.length },
    { id: "audit", label: "🔍 Audit Log", count: data.auditLog.length },
  ];

  const filteredFailed = [...data.payments.failed, ...data.payments.cancelled]
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .filter((p: any) => !search || p.phone?.includes(search) || p.mpesa_checkout_request_id?.includes(search));

  const filteredPaid = data.payments.paid.filter((p: any) =>
    !search || p.phone?.includes(search) || p.mpesa_checkout_request_id?.includes(search)
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-sm text-[color:var(--muted-foreground)] hover:text-white">← Back</Link>
          <span className="text-xs uppercase tracking-widest text-[color:var(--gold-soft)] border border-[color:var(--gold-soft)]/30 rounded px-2 py-0.5">Admin</span>
        </div>
        <button onClick={reload} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition">
          ↻ Refresh
        </button>
      </div>
      <h1 className="font-display text-3xl font-bold mb-2">Mula Admin Dashboard</h1>

      {/* Metrics strip */}
      <section className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <Metric label="Revenue KES" value={`${m.totalRevenue.toLocaleString()}`} accent />
        <Metric label="Payouts KES" value={m.totalPayouts.toLocaleString()} />
        <Metric label="Net Margin" value={m.netMargin.toLocaleString()} accent />
        <Metric label="Paid Spins" value={String(m.runCount)} />
        <Metric label="Total Spins" value={String(m.totalSpins)} />
        <Metric label="Failed Runs" value={String(m.failedRuns)} red />
        <Metric label="Failed Pays" value={String(m.failedAttempts)} red />
        <Metric label="Pending" value={String(m.pendingCount)} />
      </section>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${tab === t.id
                ? "bg-[color:var(--gold)]/20 text-[color:var(--gold-soft)] border border-[color:var(--gold)]/30"
                : "bg-white/5 text-[color:var(--muted-foreground)] hover:bg-white/10"
              }`}
          >
            {t.label}{t.count !== undefined ? ` (${t.count})` : ""}
          </button>
        ))}
      </div>

      {/* Search (for payments/runs tabs) */}
      {(tab === "payments" || tab === "failed") && (
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by phone or reference..."
          className="mt-3 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--input)] px-3 py-2 text-sm"
        />
      )}

      {/* OVERVIEW TAB */}
      {tab === "overview" && (
        <section className="mt-6 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/50 p-5">
          <h2 className="font-display text-xl font-bold mb-4">Jackpot Config</h2>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <ConfigField label="Jackpot KES" value={c.jackpot_amount_kes} onSave={(v) => updateConfig({ jackpot_amount_kes: v })} />
            <ConfigField label="Ticket KES" value={c.ticket_price_kes} onSave={(v) => updateConfig({ ticket_price_kes: v })} />
            <ConfigField label="Pool Max" value={c.pool_max} onSave={(v) => updateConfig({ pool_max: v })} />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              disabled={saving}
              onClick={() => updateConfig({ paused: !c.paused })}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${c.paused ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}
            >
              {c.paused ? "▶ Resume draws" : "⏸ Pause draws"}
            </button>
            <span className={`text-xs font-bold ${c.paused ? "text-red-400" : "text-emerald-400"}`}>
              {c.paused ? "⚠ PAUSED" : "● LIVE"}
            </span>
          </div>
          <div className="mt-5">
            <p className="text-xs uppercase tracking-widest text-[color:var(--muted-foreground)] mb-2">Prize Tiers</p>
            <div className="grid grid-cols-2 gap-1 text-xs sm:grid-cols-4">
              {(c.prize_tiers as any[]).map((t: any) => (
                <div key={t.match} className="rounded-md border border-[color:var(--border)] px-2 py-1">
                  Match {t.match} → <span className="text-[color:var(--gold-soft)]">KES {t.prize_kes.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* PAID PAYMENTS TAB */}
      {tab === "payments" && (
        <section className="mt-4 rounded-2xl border border-emerald-500/20 bg-[color:var(--card)]/50 p-5">
          <h2 className="font-display text-xl font-bold mb-1 text-emerald-400">✅ Successful Payments</h2>
          <p className="text-xs text-[color:var(--muted-foreground)] mb-4">{filteredPaid.length} paid transactions</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[color:var(--muted-foreground)] border-b border-[color:var(--border)]">
                  <th className="pb-2 pr-4">Phone</th>
                  <th className="pb-2 pr-4">Amount</th>
                  <th className="pb-2 pr-4">Reference</th>
                  <th className="pb-2 pr-4">Receipt</th>
                  <th className="pb-2">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border)]">
                {filteredPaid.map((p: any) => (
                  <tr key={p.id}>
                    <td className="py-2 pr-4 font-mono">{p.phone || "—"}</td>
                    <td className="py-2 pr-4 text-emerald-400 font-semibold">KES {p.amount_kes}</td>
                    <td className="py-2 pr-4 font-mono text-[10px] text-[color:var(--muted-foreground)] max-w-[120px] truncate">{p.mpesa_checkout_request_id || "—"}</td>
                    <td className="py-2 pr-4 font-mono text-[10px] text-[color:var(--gold-soft)]">{p.mpesa_receipt || "—"}</td>
                    <td className="py-2 text-[color:var(--muted-foreground)]">{new Date(p.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredPaid.length === 0 && <p className="text-center text-xs text-[color:var(--muted-foreground)] py-8">No paid transactions found.</p>}
          </div>
        </section>
      )}

      {/* FAILED PAYMENTS TAB */}
      {tab === "failed" && (
        <section className="mt-4 rounded-2xl border border-red-500/20 bg-[color:var(--card)]/50 p-5">
          <h2 className="font-display text-xl font-bold mb-1 text-red-400">❌ Failed & Cancelled Payments</h2>
          <p className="text-xs text-[color:var(--muted-foreground)] mb-4">
            {data.payments.failed.length} failed · {data.payments.cancelled.length} cancelled · {data.payments.pending.length} pending
          </p>

          {/* Pending payments */}
          {data.payments.pending.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-yellow-400 mb-2">⏳ Pending ({data.payments.pending.length})</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[color:var(--muted-foreground)] border-b border-[color:var(--border)]">
                      <th className="pb-2 pr-4">Phone</th>
                      <th className="pb-2 pr-4">Amount</th>
                      <th className="pb-2 pr-4">Reference</th>
                      <th className="pb-2 pr-4">Age</th>
                      <th className="pb-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--border)]">
                    {data.payments.pending.map((p: any) => {
                      const ageMins = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 60000);
                      return (
                        <tr key={p.id}>
                          <td className="py-2 pr-4 font-mono">{p.phone || "—"}</td>
                          <td className="py-2 pr-4 text-yellow-400 font-semibold">KES {p.amount_kes}</td>
                          <td className="py-2 pr-4 font-mono text-[10px] text-[color:var(--muted-foreground)] max-w-[120px] truncate">{p.mpesa_checkout_request_id || "—"}</td>
                          <td className={`py-2 pr-4 ${ageMins > 5 ? "text-red-400" : "text-yellow-400"}`}>{ageMins}m ago</td>
                          <td className="py-2">
                            <button
                              onClick={() => forceFailPayment({ data: { paymentId: p.id, runId: p.run_id } }).then(reload)}
                              className="rounded px-2 py-0.5 text-[10px] bg-red-500/20 text-red-400 hover:bg-red-500/30"
                            >
                              Force Fail
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Failed/Cancelled */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[color:var(--muted-foreground)] border-b border-[color:var(--border)]">
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Phone</th>
                  <th className="pb-2 pr-4">Amount</th>
                  <th className="pb-2 pr-4">Reference</th>
                  <th className="pb-2">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border)]">
                {filteredFailed.map((p: any) => (
                  <tr key={p.id}>
                    <td className="py-2 pr-4">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${p.status === "failed" ? "bg-red-500/20 text-red-400" : "bg-gray-500/20 text-gray-400"}`}>
                        {p.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 pr-4 font-mono">{p.phone || "—"}</td>
                    <td className="py-2 pr-4 text-[color:var(--muted-foreground)]">KES {p.amount_kes}</td>
                    <td className="py-2 pr-4 font-mono text-[10px] text-[color:var(--muted-foreground)] max-w-[140px] truncate">{p.mpesa_checkout_request_id || "—"}</td>
                    <td className="py-2 text-[color:var(--muted-foreground)]">{new Date(p.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredFailed.length === 0 && <p className="text-center text-xs text-[color:var(--muted-foreground)] py-8">No failed transactions. All clear! ✅</p>}
          </div>
        </section>
      )}

      {/* RUNS TAB */}
      {tab === "runs" && (
        <section className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/50 p-5">
          <h2 className="font-display text-xl font-bold mb-4">🎰 All Game Runs</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[color:var(--muted-foreground)] border-b border-[color:var(--border)]">
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Matched</th>
                  <th className="pb-2 pr-4">Prize KES</th>
                  <th className="pb-2">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border)]">
                {data.recentRuns.map((r: any) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-4">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${r.status === "drawn" ? "bg-emerald-500/20 text-emerald-400" :
                          r.status === "failed" ? "bg-red-500/20 text-red-400" :
                            "bg-yellow-500/20 text-yellow-400"
                        }`}>
                        {r.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 pr-4 font-mono">{r.matched_count ?? "—"}/12</td>
                    <td className={`py-2 pr-4 font-semibold ${r.prize_kes ? "text-[color:var(--gold-soft)]" : "text-[color:var(--muted-foreground)]"}`}>
                      {r.prize_kes ? `+${r.prize_kes.toLocaleString()}` : "—"}
                    </td>
                    <td className="py-2 text-[color:var(--muted-foreground)]">{new Date(r.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* USERS TAB */}
      {tab === "users" && (
        <section className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/50 p-5">
          <h2 className="font-display text-xl font-bold mb-4">👥 Users ({data.users.length})</h2>
          <ul className="divide-y divide-[color:var(--border)]">
            {data.users.map((u: any) => (
              <li key={u.id} className="flex items-center justify-between py-2.5 text-sm gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{u.display_name ?? u.phone ?? u.id.slice(0, 8)}</div>
                  <div className="text-xs text-[color:var(--muted-foreground)]">{u.email || u.phone || "—"} · {new Date(u.created_at).toLocaleDateString()}</div>
                </div>
                <button
                  onClick={() => toggleBlock({ data: { userId: u.id, blocked: !u.blocked } }).then(reload)}
                  className={`flex-shrink-0 rounded-md px-3 py-1 text-xs font-semibold transition ${u.blocked ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-white/5 text-[color:var(--muted-foreground)] hover:bg-white/10"}`}
                >
                  {u.blocked ? "🚫 Blocked" : "Block"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* COMMENTS TAB */}
      {tab === "comments" && (
        <section className="mt-4 rounded-2xl border border-[color:var(--gold)]/20 bg-[color:var(--card)]/50 p-5">
          <h2 className="font-display text-xl font-bold mb-4">💬 Player Comments ({data.comments.length})</h2>
          {data.comments.length === 0 ? (
            <p className="text-xs text-[color:var(--muted-foreground)] italic">No comments yet.</p>
          ) : (
            <ul className="divide-y divide-[color:var(--border)]">
              {data.comments.map((c: any) => (
                <li key={c.id} className="py-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-[color:var(--muted-foreground)] font-mono">{c.user_id?.slice(0, 8)}…</span>
                    <span className="text-[10px] text-[color:var(--muted-foreground)]">{new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  <p className="rounded-lg border border-[color:var(--border)]/60 bg-[color:var(--background)]/40 p-2.5 text-xs">
                    "{c.comment_text}"
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* AUDIT LOG TAB */}
      {tab === "audit" && (
        <section className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/50 p-5">
          <h2 className="font-display text-xl font-bold mb-4">🔍 Admin Audit Log</h2>
          {data.auditLog.length === 0 ? (
            <p className="text-xs text-[color:var(--muted-foreground)] italic">No audit entries recorded.</p>
          ) : (
            <ul className="divide-y divide-[color:var(--border)]">
              {data.auditLog.map((a: any) => (
                <li key={a.id} className="py-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[color:var(--gold-soft)]">{a.action}</span>
                    <span className="text-[color:var(--muted-foreground)]">{new Date(a.created_at).toLocaleString()}</span>
                  </div>
                  {a.target && <div className="text-[color:var(--muted-foreground)] mt-0.5">Target: <span className="font-mono">{a.target}</span></div>}
                  {a.details && <pre className="mt-1 text-[10px] bg-white/5 rounded p-1.5 overflow-x-auto">{JSON.stringify(a.details, null, 2)}</pre>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}

function Metric({ label, value, accent, red }: { label: string; value: string; accent?: boolean; red?: boolean }) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]/50 p-3">
      <div className="text-[9px] uppercase tracking-widest text-[color:var(--muted-foreground)] leading-tight">{label}</div>
      <div className={`mt-1 font-display text-xl font-bold ${accent ? "text-[color:var(--gold)]" : red ? "text-red-400" : ""}`}>{value}</div>
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
          className="rounded-md bg-[color:var(--gold)]/20 px-2 text-xs font-semibold text-[color:var(--gold-soft)] hover:bg-[color:var(--gold)]/30"
        >
          Save
        </button>
      </div>
    </label>
  );
}
