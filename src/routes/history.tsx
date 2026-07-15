import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyHistory } from "@/lib/draw.functions";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fetchHistory = useServerFn(getMyHistory);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    fetchHistory().then((d) => setRows(d as any[])).finally(() => setBusy(false));
  }, [fetchHistory, user]);

  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <Link to="/" className="text-sm text-[color:var(--muted-foreground)]">← Back</Link>
      <h1 className="mt-4 font-display text-3xl font-bold">Your history</h1>

      {busy ? (
        <p className="mt-6 text-sm text-[color:var(--muted-foreground)]">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/40 p-6 text-center">
          <p className="text-sm text-[color:var(--muted-foreground)]">No plays yet.</p>
          <Link to="/play" className="mt-3 inline-block text-sm font-semibold text-[color:var(--gold-soft)]">Play your first round →</Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]/50 p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-[color:var(--muted-foreground)]">
                  {new Date(r.drawn_at ?? r.created_at).toLocaleString()}
                </div>
                <div className="font-display text-lg font-bold text-[color:var(--gold-soft)]">
                  {r.matched_count ?? 0}/12
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {(r.player_numbers ?? []).map((n: number, i: number) => (
                  <span key={i} className="rounded-md border border-[color:var(--border)] px-2 py-0.5 font-mono text-xs">{n}</span>
                ))}
              </div>
              {r.prize_kes > 0 && (
                <div className="mt-2 text-sm font-semibold text-[color:var(--gold)]">Won KES {r.prize_kes.toLocaleString()}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
