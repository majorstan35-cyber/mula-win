import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/profiles/")({
  server: {
    handlers: {
      PUT: async ({ request }) => {
        const { supabase } = await import("@/lib/db.server");
        const { verifyAuthToken, json } = await import("@/lib/auth.server");

        const decoded = await verifyAuthToken(request);
        if (!decoded) return json({ message: "Unauthorized" }, 401);

        let body: any;
        try {
          body = await request.json();
        } catch {
          return json({ message: "Invalid request body" }, 400);
        }

        const { phone, display_name } = body;
        try {
          if (phone) {
            const { data: existingProfilePhone } = await supabase
              .from('profiles')
              .select('id')
              .eq('phone', phone)
              .neq('id', decoded.sub)
              .maybeSingle();

            if (existingProfilePhone) {
              return json(
                { message: "Phone number is already registered" },
                400
              );
            }
          }

          const updateData: any = {};
          if (phone !== undefined) updateData.phone = phone;
          if (display_name !== undefined) updateData.display_name = display_name;

          const { data } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', decoded.sub)
            .select('id, phone, display_name, blocked, created_at')
            .single();

          return json(data);
        } catch (err: any) {
          console.error("[api/auth/profiles] PUT error:", err.message);
          return json({ message: err.message }, 500);
        }
      },
    },
  },
});