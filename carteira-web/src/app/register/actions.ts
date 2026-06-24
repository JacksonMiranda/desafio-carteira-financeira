'use server';

import { redirect } from 'next/navigation';
import { ApiError, apiFetch } from '@/lib/api';
import { setToken } from '@/lib/session';
import type { AuthState } from '../login/actions';

export async function registerAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const name = String(formData.get('name') ?? '');
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  try {
    await apiFetch('/auth/register', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ name, email, password }),
    });

    // Autentica logo após o cadastro para já levar o usuário ao dashboard.
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
    return { error: 'Não foi possível concluir o cadastro. Tente novamente.' };
  }

  redirect('/');
}
