import jwt from "jsonwebtoken";

// Server-only JWT verification helper used by API route handlers.
const JWT_SECRET =
  process.env.JWT_SECRET || "super_secret_lucky_spin_jwt_key";

export function generateSession(user: {
  id: string;
  email: string;
  phone?: string;
  display_name?: string;
}) {
  const token = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      phone: user.phone || "",
      display_name: user.display_name || "",
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  return {
    access_token: token,
    token_type: "bearer",
    expires_in: 604800,
    refresh_token: "refresh_" + Math.random().toString(36).substring(7),
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone || "",
      user_metadata: { display_name: user.display_name || "" },
    },
  };
}

export async function verifyAuthToken(
  request: Request
): Promise<{ sub: string; email: string; phone?: string; display_name?: string } | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded;
  } catch {
    return null;
  }
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
