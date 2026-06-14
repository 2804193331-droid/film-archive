const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,32}$/;
const INTERNAL_AUTH_DOMAIN = "film-archive.local";

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function isValidUsername(username: string) {
  return USERNAME_PATTERN.test(normalizeUsername(username));
}

export function usernameToAuthEmail(username: string) {
  return `${normalizeUsername(username)}@${INTERNAL_AUTH_DOMAIN}`;
}

export const usernameHelpText = "用户名只能使用 3-32 位字母、数字、下划线或短横线。";
