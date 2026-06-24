'use server';

import { redirect } from 'next/navigation';
import { ApiError, apiFetch } from '@/lib/api';
import { setToken } from '@/lib/session';

export type AuthState = { error?: string };

export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  try {
    const { access_token } = await apiFetch<{ access_token: string }>(
      '/auth/login',
      {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ email, password }),
      },
    );
    await setToken(access_token);
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    return { error: 'Não foi possível entrar. Tente novamente.' };
  }

  // redirect lança NEXT_REDIRECT; fica fora do try para não ser capturado.
  redirect('/');
}
