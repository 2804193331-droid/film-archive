import type { AppSession } from "@/lib/app-session";

export function isAdminUser(userId: string, username: string) {
  const adminIds = splitEnvList(process.env.ADMIN_USER_IDS);
  const adminUsernames = splitEnvList(process.env.ADMIN_USERNAMES).map((item) => item.toLowerCase());
  return adminIds.includes(userId) || adminUsernames.includes(username.toLowerCase());
}

export function isAdminSession(session?: AppSession | null) {
  return Boolean(session && isAdminUser(session.id, session.username));
}

export function hasAdminConfig() {
  return Boolean(process.env.ADMIN_USER_IDS?.trim() || process.env.ADMIN_USERNAMES?.trim());
}

export function canAccessAdmin(session?: AppSession | null) {
  if (!session) {
    return false;
  }

  if (process.env.NODE_ENV !== "production" && !hasAdminConfig()) {
    return true;
  }

  return isAdminSession(session);
}

export function canManageStorage(session?: AppSession | null) {
  return process.env.NODE_ENV !== "production" || canAccessAdmin(session);
}

function splitEnvList(value?: string) {
  return value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean) ?? [];
}
