// API routes are now embedded directly in this TanStack Start app.
// Using relative /api path works in all environments:
//   - Browser: resolved against window.location.origin automatically
//   - Android WebView: resolved against the webview's origin
//   - SSR: server functions use BACKEND_API_URL env var (set to http://localhost:PORT/api)
// Browser uses the public API base (set VITE_BACKEND_API_URL to your tunnel,
// e.g. https://spin.loca.lt/api, so Hostinger's frontend talks to your local
// backend). Server side uses BACKEND_API_URL (or localhost:3000 fallback).
const BACKEND_URL =
  typeof window !== "undefined"
    ? (import.meta.env as any).VITE_BACKEND_API_URL || "/api"
    : (typeof process !== "undefined" && process.env?.BACKEND_API_URL) ||
      `http://localhost:${process.env.PORT || 3000}/api`;


function decodeJwt(token: string): any {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

class MockSupabaseAuth {
  private listeners: Array<(event: string, session: any) => void> = [];

  constructor() {
    // Check if token exists in localStorage on startup
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("spin_token");
      if (token) {
        this.getSession().then(({ data }) => {
          if (data?.session) {
            this.trigger("SIGNED_IN", data.session);
          }
        });
      }
    }
  }

  async signUp({ email, password, phone, options }: any) {
    try {
      const response = await fetch(`${BACKEND_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          phone: phone || options?.data?.phone,
          displayName: options?.data?.display_name,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { data: null, error: new Error(data.message || "Signup failed") };
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("spin_token", data.session.access_token);
      }
      this.trigger("SIGNED_IN", data.session);
      return { data: { user: data.user, session: data.session }, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }

  async signInWithPassword({ email, password }: any) {
    try {
      const response = await fetch(`${BACKEND_URL}/auth/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { data: null, error: new Error(data.message || "Signin failed") };
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("spin_token", data.session.access_token);
      }
      this.trigger("SIGNED_IN", data.session);
      return { data: { user: data.user, session: data.session }, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }

  async signOut() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("spin_token");
    }
    this.trigger("SIGNED_OUT", null);
    return { error: null };
  }

  async getSession() {
    if (typeof window === "undefined") {
      return { data: { session: null }, error: null };
    }
    const token = localStorage.getItem("spin_token");
    if (!token) return { data: { session: null }, error: null };

    const decoded = decodeJwt(token);
    if (!decoded || (decoded.exp && decoded.exp * 1000 < Date.now())) {
      localStorage.removeItem("spin_token");
      return { data: { session: null }, error: null };
    }

    const session = {
      access_token: token,
      user: {
        id: decoded.sub,
        email: decoded.email,
        phone: decoded.phone,
        user_metadata: { display_name: decoded.display_name },
      },
    };
    return { data: { session }, error: null };
  }

  onAuthStateChange(callback: (event: string, session: any) => void) {
    this.listeners.push(callback);
    this.getSession().then(({ data }) => {
      if (data?.session) callback("SIGNED_IN", data.session);
    });
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.listeners = this.listeners.filter((l) => l !== callback);
          },
        },
      },
    };
  }

  private trigger(event: string, session: any) {
    this.listeners.forEach((l) => {
      try {
        l(event, session);
      } catch (err) {
        console.error("Auth state change callback error:", err);
      }
    });
  }
}

class QueryBuilder {
  private table: string;
  private filters: Record<string, any> = {};

  constructor(table: string) {
    this.table = table;
  }

  select(fields: string) {
    return this;
  }

  update(data: any) {
    this.filters.updateData = data;
    return this;
  }

  eq(field: string, value: any) {
    this.filters[field] = value;
    return this;
  }

  async maybeSingle() {
    return this.execute();
  }

  async single() {
    return this.execute();
  }

  async then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute() {
    const token = typeof window !== "undefined" ? localStorage.getItem("spin_token") : null;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      if (this.table === "profiles") {
        if (this.filters.updateData) {
          // Update profile
          const response = await fetch(`${BACKEND_URL}/auth/profiles/`, {
            method: "PUT",
            headers,
            body: JSON.stringify(this.filters.updateData),
          });
          const data = await response.json();
          if (!response.ok) return { data: null, error: new Error(data.message) };
          return { data, error: null };
        } else {
          // Get profile
          const response = await fetch(`${BACKEND_URL}/auth/profiles/me`, {
            method: "GET",
            headers,
          });
          const data = await response.json();
          if (!response.ok) return { data: null, error: new Error(data.message) };
          return { data, error: null };
        }
      }
      return { data: null, error: new Error("Unsupported local table query: " + this.table) };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }
}

export const supabase = {
  auth: new MockSupabaseAuth(),
  from(table: string) {
    return new QueryBuilder(table);
  },
};
