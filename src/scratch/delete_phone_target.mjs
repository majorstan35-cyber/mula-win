import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "https://bimncazhqsoraeztekcc.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "sb_secret_p1hikiAetKuXcKMSkIaUUg_BQNoJbf3";

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function removePhone() {
  const targetPhones = ["0758608120", "254758608120", "+254758608120"];
  console.log("Searching for records associated with phone:", targetPhones);

  // 1. Check users table
  const { data: users, error: uErr } = await supabase
    .from("users")
    .select("id, email, phone")
    .in("phone", targetPhones);

  if (uErr) console.error("Error querying users:", uErr.message);
  console.log("Found users:", users);

  // 2. Check profiles table
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, phone")
    .in("phone", targetPhones);
  console.log("Found profiles:", profiles);

  // Collect all matching user IDs
  const userIds = new Set([
    ...(users || []).map((u) => u.id),
    ...(profiles || []).map((p) => p.id),
  ]);

  if (userIds.size > 0) {
    const ids = Array.from(userIds);
    console.log(`Deleting ${ids.length} user record(s):`, ids);

    // Delete associated runs, payments, user_roles, profiles, and users
    await supabase.from("payments").delete().in("user_id", ids);
    await supabase.from("runs").delete().in("user_id", ids);
    await supabase.from("user_roles").delete().in("user_id", ids);
    await supabase.from("profiles").delete().in("id", ids);
    const { error: delErr } = await supabase.from("users").delete().in("id", ids);

    if (delErr) {
      console.error("Error deleting from users:", delErr.message);
    } else {
      console.log("✓ Successfully deleted matching user records from database.");
    }
  } else {
    console.log("No matching user records found by phone column.");
  }

  // 3. Also cleanup payments table by phone number directly
  const { data: paymentsDeleted, error: payDelErr } = await supabase
    .from("payments")
    .delete()
    .in("phone", targetPhones)
    .select("id");

  if (!payDelErr && paymentsDeleted) {
    console.log(`✓ Cleaned up ${paymentsDeleted.length} payment records for target phone.`);
  }

  console.log("\nCleanup complete.");
}

removePhone().catch((err) => {
  console.error("Fatal error during phone removal:", err);
});
