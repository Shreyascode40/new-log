import "server-only";

import { createHmac } from "node:crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export class BackendApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status = 500,
  ) {
    super(message);
    this.name = "BackendApiError";
  }
}

function internalToken(userId: string): string {
  const raw = process.env.API_INTERNAL_SECRET?.trim() ?? "";
  const secret = raw.replace(/^["']|["']$/g, "").trim();
  if (!secret || secret.length < 32) {
    throw new Error("API_INTERNAL_SECRET must contain at least 32 characters.");
  }
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, aud: "be-logbook-api", exp: Math.floor(Date.now() / 1000) + 60 }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

async function backendFetch<T>(userId: string, path: string, init: RequestInit = {}): Promise<T> {
  const isProd = process.env.NODE_ENV === "production";
  const configuredUrl = (process.env.API_SERVICE_URL || process.env.API_BASE_URL || "").trim();
  const baseUrl = configuredUrl || (isProd ? "" : "http://localhost:4000");

  if (!baseUrl) {
    throw new BackendApiError(
      "API_BASE_URL is not configured in Vercel environment variables. Please add API_BASE_URL pointing to your Render service URL (e.g. https://your-service.onrender.com).",
      "API_NOT_CONFIGURED",
      500,
    );
  }

  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${internalToken(userId)}`);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const baseWithSlash = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const relativePath = path.startsWith("/") ? path.slice(1) : path;
  const targetUrl = new URL(relativePath, baseWithSlash);

  let response: Response;
  try {
    response = await fetch(targetUrl, {
      ...init,
      cache: "no-store",
      headers,
    });
  } catch (error) {
    console.error(`[backend-api] fetch failed to ${targetUrl.toString()}:`, error);
    throw new BackendApiError(
      `Could not reach backend API at ${baseUrl}. Please verify your Render service is Live and reachable.`,
      "BACKEND_UNREACHABLE",
      502,
    );
  }

  const body = (await response.json().catch(() => ({}))) as { error?: string; code?: string } & T;
  if (!response.ok) {
    throw new BackendApiError(
      body.error ?? `Backend request failed (${response.status}).`,
      body.code,
      response.status,
    );
  }
  return body;
}

export async function backendSystemApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  return backendFetch<T>("system", path, init);
}

export async function backendApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Authentication required.");
  return backendFetch<T>(session.user.id, path, init);
}
