import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/signin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabase } = await import("@/lib/db.server");
        const { generateSession, json } = await import("@/lib/auth.server");
        const bcrypt = await import("bcrypt");

        let body: any;
        try {
          body = await request.json();
        } catch {
          return json({ message: "Invalid request body" }, 400);
        }

        const { email, password } = body;
        if (!email || !password) {
          return json({ message: "Email and password are required" }, 400);
        }

        try {
          const { data: users } = await supabase
            .from('users')
            .select('*')
            .eq('email', email);

          const user = users && users.length > 0 ? users[0] : null;
          if (!user) {
            return json({ message: "Invalid email or password" }, 400);
          }

          const isValid = await bcrypt.compare(password, user.password_hash);
          if (!isValid) {
            return json({ message: "Invalid email or password" }, 400);
          }

          const { data: profiles } = await supabase
            .from('profiles')
            .select('phone, display_name, blocked')
            .eq('id', user.id);

          const profile = profiles && profiles.length > 0 ? profiles[0] : null;

          if (profile?.blocked) {
            return json({ message: "Account is blocked" }, 403);
          }

          const session = generateSession({
            id: user.id,
            email: user.email,
            phone: profile?.phone,
            display_name: profile?.display_name,
          });

          return json({ user: session.user, session });
        } catch (err: any) {
          console.error("[api/auth/signin] error:", err.message);
          return json({ message: err.message || "Signin failed" }, 500);
        }
      },
    },
  },
});