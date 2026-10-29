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
  const secret = process.env.API_INTERNAL_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("API_INTERNAL_SECRET must contain at least 32 characters.");
  }
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, aud: "be-logbook-api", exp: Math.floor(Date.now() / 1000) + 60 }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function getBackendBaseUrl(): string {
  const boundUrl = process.env.API_SERVICE_URL;
  if (boundUrl && boundUrl.trim().length > 0) {
    return boundUrl.trim();
  }
  return process.env.API_BASE_URL?.trim() || "http://localhost:4000";
}

async function backendFetch<T>(userId: string, path: string, init: RequestInit = {}): Promise<T> {
  const baseUrl = getBackendBaseUrl();
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${internalToken(userId)}`);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const targetUrl = cleanBase.endsWith("/") ? `${cleanBase}${cleanPath.slice(1)}` : `${cleanBase}${cleanPath}`;
  const response = await fetch(targetUrl, {
    ...init,
    cache: "no-store",
    headers,
  });
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
