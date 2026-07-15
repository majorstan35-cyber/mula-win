import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          phone: phone || undefined,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.user && phone) {
          await supabase.from("profiles").update({ phone }).eq("id", data.user.id);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/" });
    } catch (e: any) {
      setErr(e.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <Link to="/" className="mb-8 flex items-center gap-2">
        <div className="bg-gold-gradient shadow-gold-soft flex h-9 w-9 items-center justify-center rounded-full font-display text-lg font-black text-[oklch(0.14_0.01_60)]">M</div>
        <span className="font-display text-xl font-bold tracking-tight">Mula</span>
      </Link>

      <h1 className="font-display text-3xl font-bold">{mode === "signup" ? "Create account" : "Welcome back"}</h1>
      <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
        {mode === "signup" ? "Play the KES 1,000,000 jackpot." : "Sign in to keep playing."}
      </p>

      <form onSubmit={submit} className="mt-6 space-y-3">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--input)] px-4 py-3 text-sm outline-none focus:border-[color:var(--gold)]"
        />
        {mode === "signup" && (
          <input
            type="tel"
            placeholder="M-Pesa phone (e.g. 0712345678)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--input)] px-4 py-3 text-sm outline-none focus:border-[color:var(--gold)]"
          />
        )}
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--input)] px-4 py-3 text-sm outline-none focus:border-[color:var(--gold)]"
        />

        {err && <div className="rounded-lg border border-[color:var(--destructive)]/40 bg-[color:var(--destructive)]/10 px-3 py-2 text-xs text-[color:var(--destructive)]">{err}</div>}

        <button
          type="submit"
          disabled={loading}
          className="bg-gold-gradient shadow-gold w-full rounded-xl py-3.5 font-display text-lg font-bold text-[oklch(0.12_0.01_60)] disabled:opacity-60"
        >
          {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
        className="mt-6 text-center text-xs text-[color:var(--muted-foreground)] underline"
      >
        {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
      </button>
    </main>
  );
}
