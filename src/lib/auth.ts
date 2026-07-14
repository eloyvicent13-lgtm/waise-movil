import * as SecureStore from "expo-secure-store";

export const SERVER_URL = "http://149.202.84.78:8103";
const KEY = "waise_token";

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY);
}
export async function setToken(token: string) {
  await SecureStore.setItemAsync(KEY, token);
}
export async function clearToken() {
  await SecureStore.deleteItemAsync(KEY);
}

async function authRequest(path: string, username: string, password: string) {
  const resp = await fetch(`${SERVER_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok || !body.token) throw new Error(body.error || `error ${resp.status}`);
  await setToken(body.token);
  return { username: body.username || username };
}

export const login = (u: string, p: string) => authRequest("/auth/login", u, p);
export const register = (u: string, p: string) => authRequest("/auth/register", u, p);

export async function serverFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  if (!token) throw new Error("no has iniciado sesión");
  return fetch(`${SERVER_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}), Authorization: `Bearer ${token}` },
  });
}
