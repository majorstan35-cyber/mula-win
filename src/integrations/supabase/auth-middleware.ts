import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { supabase } from "./client";

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_lucky_spin_jwt_key";

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const request = getRequest();

    if (!request?.headers) {
      throw new Error("Unauthorized: No request headers available");
    }

    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      throw new Error("Unauthorized: No authorization header provided");
    }

    if (!authHeader.startsWith("Bearer ")) {
      throw new Error("Unauthorized: Only Bearer tokens are supported");
    }

    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      throw new Error("Unauthorized: No token provided");
    }

    try {
      const jwtModule = await import("jsonwebtoken");
      const jwt = jwtModule.default || jwtModule;
      const decoded = jwt.verify(token, JWT_SECRET) as any;

      if (!decoded || !decoded.sub) {
        throw new Error("Unauthorized: Invalid token structure");
      }

      // Attach user details mock context expected by functions
      return next({
        context: {
          supabase,
          userId: decoded.sub,
          claims: decoded,
        },
      });
    } catch (err: any) {
      console.error("Local token verification failed on serverFn middleware:", err.message);
      throw new Error("Unauthorized: Invalid or expired token");
    }
  }
);
