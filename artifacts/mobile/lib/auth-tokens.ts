import { getSecureItem, setSecureItem, deleteSecureItem } from "./secure-storage";
import { getApiUrl } from "./query-client";

const ACCESS_KEY = "taryaq.accessToken";
const REFRESH_KEY = "taryaq.refreshToken";
const ACCESS_EXP_KEY = "taryaq.accessExpiresAt";
const REFRESH_EXP_KEY = "taryaq.refreshExpiresAt";

const REFRESH_THRESHOLD_MS = 60 * 1000;

interface TokenSet {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
}

export async function saveTokens(t: TokenSet): Promise<void> {
  await Promise.all([
    setSecureItem(ACCESS_KEY, t.accessToken),
    setSecureItem(REFRESH_KEY, t.refreshToken),
    setSecureItem(ACCESS_EXP_KEY, String(t.accessExpiresAt)),
    setSecureItem(REFRESH_EXP_KEY, String(t.refreshExpiresAt)),
  ]);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    deleteSecureItem(ACCESS_KEY),
    deleteSecureItem(REFRESH_KEY),
    deleteSecureItem(ACCESS_EXP_KEY),
    deleteSecureItem(REFRESH_EXP_KEY),
  ]);
}

export async function getStoredTokens(): Promise<TokenSet | null> {
  const [a, r, ae, re] = await Promise.all([
    getSecureItem(ACCESS_KEY),
    getSecureItem(REFRESH_KEY),
    getSecureItem(ACCESS_EXP_KEY),
    getSecureItem(REFRESH_EXP_KEY),
  ]);
  if (!a || !r || !ae || !re) return null;
  return {
    accessToken: a,
    refreshToken: r,
    accessExpiresAt: Number(ae),
    refreshExpiresAt: Number(re),
  };
}

let refreshPromise: Promise<TokenSet | null> | null = null;

async function refreshNow(refreshToken: string): Promise<TokenSet | null> {
  try {
    const res = await fetch(`${getApiUrl()}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      await clearTokens();
      return null;
    }
    const data = await res.json() as TokenSet & { success?: boolean };
    const next: TokenSet = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      accessExpiresAt: data.accessExpiresAt,
      refreshExpiresAt: data.refreshExpiresAt,
    };
    await saveTokens(next);
    return next;
  } catch {
    return null;
  }
}

export async function getValidAccessToken(): Promise<string | null> {
  const tokens = await getStoredTokens();
  if (!tokens) return null;
  const now = Date.now();
  if (tokens.refreshExpiresAt < now) {
    await clearTokens();
    return null;
  }
  if (tokens.accessExpiresAt - now > REFRESH_THRESHOLD_MS) {
    return tokens.accessToken;
  }
  if (!refreshPromise) {
    refreshPromise = refreshNow(tokens.refreshToken).finally(() => {
      refreshPromise = null;
    });
  }
  const refreshed = await refreshPromise;
  return refreshed?.accessToken ?? null;
}

export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await getValidAccessToken();
  const headers = new Headers(init.headers as HeadersInit | undefined);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  let res = await fetch(input, { ...init, headers });
  if (res.status === 401) {
    const tokens = await getStoredTokens();
    if (tokens) {
      const refreshed = await refreshNow(tokens.refreshToken);
      if (refreshed) {
        headers.set("Authorization", `Bearer ${refreshed.accessToken}`);
        res = await fetch(input, { ...init, headers });
      }
    }
  }
  return res;
}
