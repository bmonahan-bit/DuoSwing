import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

const http = httpRouter();

// Handle CORS preflight
http.route({
  path: "/waitlist",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => {
    return corsResponse(null, 204, request.headers.get("Origin"));
  }),
});

// Waitlist signup — proxies to MailerLite server-side
http.route({
  path: "/waitlist",
  method: "POST",
  handler: httpAction(async (_ctx, request) => {
    const origin = request.headers.get("Origin");
    let body: { email?: string; type?: string };

    try {
      body = await request.json();
    } catch {
      return corsResponse({ error: "Invalid JSON" }, 400, origin);
    }

    const { email, type } = body;

    if (!email || !email.includes("@")) {
      return corsResponse({ error: "Invalid email" }, 400, origin);
    }

    const apiKey = process.env.MAILERLITE_API_KEY;
    if (!apiKey) {
      console.error("MAILERLITE_API_KEY env var not set");
      return corsResponse({ error: "Server misconfigured" }, 500, origin);
    }

    const mlRes = await fetch("https://connect.mailerlite.com/api/subscribers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        email,
        fields: { signup_type: type ?? "golfer" },
      }),
    });

    if (!mlRes.ok) {
      const errText = await mlRes.text();
      console.error("MailerLite error:", mlRes.status, errText);
      return corsResponse({ error: "Signup failed" }, 502, origin);
    }

    return corsResponse({ ok: true }, 200, origin);
  }),
});

function corsResponse(
  body: unknown,
  status: number,
  origin: string | null
): Response {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (body === null) {
    return new Response(null, { status, headers });
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

export default http;
