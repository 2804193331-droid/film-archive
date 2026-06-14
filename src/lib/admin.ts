import type { AppSession } from "@/lib/app-session";

export function isAdminUser(userId: string, username: string) {
  const adminIds = splitEnvList(process.env.ADMIN_USER_IDS);
  const adminUsernames = splitEnvList(process.env.ADMIN_USERNAMES);
  return adminIds.includes(userId) || adminUsernames.includes(username);
}

export function isAdminSession(session?: AppSession | null) {
  return Boolean(session && isAdminUser(session.id, session.username));
}

export function canManageStorage(session?: AppSession | null) {
  return process.env.NODE_ENV !== "production" || isAdminSession(session);
}

function splitEnvList(value?: string) {
  return value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean) ?? [];
}
