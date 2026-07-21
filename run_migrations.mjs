import https from 'https';

const PROJECT_ID = 'bimncazhqsoraeztekcc';
const SERVICE_ROLE_KEY = 'sb_secret_p1hikiAetKuXcKMSkIaUUg_BQNoJbf3';
const SUPABASE_URL = 'bimncazhqsoraeztekcc.supabase.co';

const FULL_SQL = `
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  phone TEXT UNIQUE,
  raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $body$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
  END IF;
END $body$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS \\$\\$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
\\$\\$;

DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'users read own roles') THEN
    CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated
      USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
  END IF;
END $body$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS \\$\\$
BEGIN NEW.updated_at = now(); RETURN NEW; END; \\$\\$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  phone TEXT UNIQUE,
  display_name TEXT,
  blocked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'read own profile') THEN
    CREATE POLICY "read own profile" ON public.profiles FOR SELECT TO authenticated
      USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'update own profile') THEN
    CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated
      USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;
END $body$;

DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_profiles_updated') THEN
    CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $body$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS \\$\\$
BEGIN
  INSERT INTO public.profiles (id, phone) VALUES (NEW.id, NEW.phone) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; \\$\\$;

DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_user_created') THEN
    CREATE TRIGGER on_user_created AFTER INSERT ON public.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $body$;

CREATE TABLE IF NOT EXISTS public.jackpot_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  jackpot_amount_kes INTEGER NOT NULL DEFAULT 1000000,
  ticket_price_kes INTEGER NOT NULL DEFAULT 200,
  pool_min INTEGER NOT NULL DEFAULT 1,
  pool_max INTEGER NOT NULL DEFAULT 40,
  numbers_per_draw INTEGER NOT NULL DEFAULT 12,
  prize_tiers JSONB NOT NULL DEFAULT '[{"match":6,"prize_kes":500},{"match":7,"prize_kes":1500},{"match":8,"prize_kes":5000},{"match":9,"prize_kes":20000},{"match":10,"prize_kes":50000},{"match":11,"prize_kes":200000},{"match":12,"prize_kes":1000000}]'::jsonb,
  paused BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.jackpot_config TO authenticated, anon;
GRANT ALL ON public.jackpot_config TO service_role;
ALTER TABLE public.jackpot_config ENABLE ROW LEVEL SECURITY;

DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'jackpot_config' AND policyname = 'anyone reads active config') THEN
    CREATE POLICY "anyone reads active config" ON public.jackpot_config FOR SELECT TO authenticated, anon USING (active = TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'jackpot_config' AND policyname = 'admins manage config') THEN
    CREATE POLICY "admins manage config" ON public.jackpot_config FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $body$;

DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_jackpot_updated') THEN
    CREATE TRIGGER trg_jackpot_updated BEFORE UPDATE ON public.jackpot_config
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $body$;

INSERT INTO public.jackpot_config (active) SELECT TRUE WHERE NOT EXISTS (SELECT 1 FROM public.jackpot_config);

CREATE TABLE IF NOT EXISTS public.rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_number BIGSERIAL UNIQUE NOT NULL,
  server_seed TEXT NOT NULL,
  seed_hash TEXT NOT NULL,
  target_numbers INTEGER[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revealed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rounds TO authenticated, anon;
GRANT ALL ON public.rounds TO service_role;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;

DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rounds' AND policyname = 'public read rounds') THEN
    CREATE POLICY "public read rounds" ON public.rounds FOR SELECT TO authenticated, anon USING (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rounds' AND policyname = 'admins manage rounds') THEN
    CREATE POLICY "admins manage rounds" ON public.rounds FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $body$;

CREATE TABLE IF NOT EXISTS public.runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES public.rounds(id),
  status TEXT NOT NULL DEFAULT 'pending',
  player_numbers INTEGER[],
  matched_count INTEGER,
  prize_kes INTEGER NOT NULL DEFAULT 0,
  drawn_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.runs TO authenticated;
GRANT ALL ON public.runs TO service_role;
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;

DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'runs' AND policyname = 'read own runs') THEN
    CREATE POLICY "read own runs" ON public.runs FOR SELECT TO authenticated
      USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
  END IF;
END $body$;

DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_runs_updated') THEN
    CREATE TRIGGER trg_runs_updated BEFORE UPDATE ON public.runs
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $body$;

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  run_id UUID REFERENCES public.runs(id) ON DELETE SET NULL,
  amount_kes INTEGER NOT NULL,
  phone TEXT NOT NULL,
  mpesa_checkout_request_id TEXT,
  mpesa_receipt TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  raw_callback JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'read own payments') THEN
    CREATE POLICY "read own payments" ON public.payments FOR SELECT TO authenticated
      USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
  END IF;
END $body$;

DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payments_updated') THEN
    CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $body$;

CREATE TABLE IF NOT EXISTS public.admin_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_audit TO authenticated;
GRANT ALL ON public.admin_audit TO service_role;
ALTER TABLE public.admin_audit ENABLE ROW LEVEL SECURITY;

DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_audit' AND policyname = 'admins read audit') THEN
    CREATE POLICY "admins read audit" ON public.admin_audit FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_audit' AND policyname = 'admins insert audit') THEN
    CREATE POLICY "admins insert audit" ON public.admin_audit FOR INSERT TO authenticated
      WITH CHECK (public.has_role(auth.uid(), 'admin') AND admin_id = auth.uid());
  END IF;
END $body$;

CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  run_id UUID REFERENCES public.runs(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_comments_user ON public.comments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_user ON public.runs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_round ON public.runs(round_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_checkout ON public.payments(mpesa_checkout_request_id);

REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
`;

function runSQL(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const options = {
      hostname: SUPABASE_URL,
      path: '/rest/v1/sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
      }
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        if (data) console.log(`Response: ${data.substring(0, 800)}`);
        resolve({ status: res.statusCode, body: data });
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

console.log('🚀 Running all migrations against Supabase...\n');
runSQL(FULL_SQL).then(r => {
  if (r.status >= 200 && r.status < 300) {
    console.log('\n✅ All migrations completed successfully! Your database is ready.');
  } else {
    console.log('\n❌ Migration failed. See response above.');
  }
}).catch(err => {
  console.error('Error:', err.message);
});
