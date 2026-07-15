// Server-only Supabase admin client + one-time schema initialization.
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';

const supabase: SupabaseClient = createClient(
  process.env.SUPABASE_URL || 'https://bimncazhqsoraeztekcc.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_p1hikiAetKuXcKMSkIaUUg_BQNoJbf3'
);

export { supabase };

let _initPromise: Promise<void> | null = null;

async function runInit() {
  console.log("[db] Initializing schema via Supabase...");

  // Check if public.users exists
  const { error } = await supabase
    .from('users')
    .select('id')
    .limit(1);

  if (error && (error.code === '42P01' || /does not exist/i.test(error.message || ''))) {
    console.error('[db] public.users table does not exist.');
    console.error('[db] Please run the migration SQL in Supabase SQL Editor first.');
    console.error('[db] URL: https://bimncazhqsoraeztekcc.supabase.co/project/sql/new');
    throw new Error('Database not initialized. Run migrations first.');
  }

  // Seed default admin users into public.users
  const defaultAdmins = [
    { email: 'superadmin@luckyspin.co.ke', password: 'SuperPassword123!', display_name: 'Super Administrator' },
    { email: 'admin@luckyspin.co.ke', password: 'AdminPassword123!', display_name: 'Admin' },
  ];

  for (const admin of defaultAdmins) {
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', admin.email)
      .maybeSingle();

    if (!existing) {
      console.log(`[db] Seeding admin user: ${admin.email}`);
      const passwordHash = await bcrypt.hash(admin.password, 10);
      const { data: insertData, error: insertError } = await supabase
        .from('users')
        .insert({
          email: admin.email,
          password_hash: passwordHash,
          phone: null,
          raw_user_meta_data: { display_name: admin.display_name }
        })
        .select('id')
        .single();

      if (insertError) {
        console.error(`[db] Failed to seed admin ${admin.email}:`, insertError.message);
        continue;
      }

      const userId = insertData.id;

      // Ensure profile exists
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ id: userId, phone: null, display_name: admin.display_name, blocked: false });

      if (profileError) {
        console.error(`[db] Failed to create profile for ${admin.email}:`, profileError.message);
      }

      // Assign admin role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: 'admin' });

      if (roleError && roleError.code !== '23505') {
        console.error(`[db] Failed to assign role for ${admin.email}:`, roleError.message);
      }
    }
  }

  console.log("[db] Schema initialization complete.");
}

// Runs once; retries on a later request if it failed.
export function ensureDbInitialized(): Promise<void> {
  if (!_initPromise) {
    _initPromise = runInit().catch((err) => {
      _initPromise = null;
      console.error("[db] Initialization failed:", err.message);
      throw err;
    });
  }
  return _initPromise;
}
