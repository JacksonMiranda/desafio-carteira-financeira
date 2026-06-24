import { cookies } from 'next/headers';

// O JWT fica num cookie httpOnly: inacessível ao JS do cliente (mitiga XSS) e
// disponível ao servidor para os Server Actions encaminharem à API.
const TOKEN_COOKIE = 'access_token';

export async function setToken(token: string): Promise<void> {
  const store = await cookies();
  store.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

export async function getToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(TOKEN_COOKIE)?.value;
}

export async function clearToken(): Promise<void> {
  const store = await cookies();
  store.delete(TOKEN_COOKIE);
}
