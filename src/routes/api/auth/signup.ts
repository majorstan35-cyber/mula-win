import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/signup")({
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

        const { email, password, phone, displayName } = body;
        if (!email || !password) {
          return json({ message: "Email and password are required" }, 400);
        }

        try {
          const { data: existing } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .maybeSingle();

          if (existing) {
            return json(
              { message: "User already exists", code: "user_already_exists" },
              400
            );
          }

          if (phone) {
            const { data: existingPhone } = await supabase
              .from('users')
              .select('id')
              .eq('phone', phone)
              .maybeSingle();

            if (existingPhone) {
              return json(
                { message: "Phone number is already registered", code: "phone_already_exists" },
                400
              );
            }
          }

          const passwordHash = await bcrypt.hash(password, 10);
          const { data: insertData } = await supabase
            .from('users')
            .insert({
              email,
              password_hash: passwordHash,
              phone: phone || null,
              raw_user_meta_data: { display_name: displayName || "" }
            })
            .select('id')
            .single();

          if (!insertData) {
            return json({ message: "Signup failed" }, 500);
          }

          const userId = insertData.id;

          if (displayName) {
            await supabase
              .from('profiles')
              .update({ display_name: displayName })
              .eq('id', userId);
          }
          if (phone) {
            await supabase
              .from('profiles')
              .update({ phone: phone })
              .eq('id', userId);
          }

          const session = generateSession({
            id: userId,
            email,
            phone,
            display_name: displayName,
          });
          return json({ user: session.user, session }, 201);
        } catch (err: any) {
          console.error("[api/auth/signup] error:", err.message);
          return json({ message: err.message || "Signup failed" }, 500);
        }
      },
    },
  },
});