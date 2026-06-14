import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

export const APP_SESSION_COOKIE = "film_archive_session";

export type AppSession = {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  createdAt?: string;
};

export function setAppSessionCookie(response: NextResponse, session: AppSession) {
  response.cookies.set(APP_SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

export function clearAppSessionCookie(response: NextResponse) {
  response.cookies.set(APP_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export function getAppSessionFromRequest(request: NextRequest) {
  const token = request.cookies.get(APP_SESSION_COOKIE)?.value;
  return token ? decodeSession(token) : null;
}

export async function getAppSessionFromServerCookies() {
  const cookieStore = await cookies();
  const token = cookieStore.get(APP_SESSION_COOKIE)?.value;
  return token ? decodeSession(token) : null;
}

function encodeSession(session: AppSession) {
  const payload = base64UrlEncode(
    JSON.stringify({
      ...session,
      exp: Date.now() + 60 * 60 * 24 * 30 * 1000
    })
  );
  return `${payload}.${sign(payload)}`;
}

function decodeSession(token: string): AppSession | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return null;
  }

  try {
    if (!hasValidSignature(payload, signature)) {
      return null;
    }

    const parsed = JSON.parse(base64UrlDecode(payload)) as AppSession & { exp?: number };
    if (!parsed.id || !parsed.username || !parsed.displayName || !parsed.exp || parsed.exp < Date.now()) {
      return null;
    }

    return {
      id: parsed.id,
      username: parsed.username,
      displayName: parsed.displayName,
      email: parsed.email,
      avatarUrl: parsed.avatarUrl,
      createdAt: parsed.createdAt
    };
  } catch {
    return null;
  }
}

function sign(payload: string) {
  return crypto.createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

function sessionSecret() {
  const explicitSecret = process.env.APP_SESSION_SECRET?.trim();
  if (explicitSecret) {
    return explicitSecret;
  }

  if (process.env.NODE_ENV !== "production" && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return process.env.SUPABASE_SERVICE_ROLE_KEY;
  }

  throw new Error("APP_SESSION_SECRET must be configured.");
}

function hasValidSignature(payload: string, signature: string) {
  const expected = sign(payload);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  return expectedBuffer.length === signatureBuffer.length && crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}
