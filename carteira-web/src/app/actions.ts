'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ApiError, apiFetch } from '@/lib/api';
import { reaisToCents } from '@/lib/money';
import { clearToken } from '@/lib/session';

export type OpState = { error?: string; success?: string };

function toMessage(error: unknown, fallback: string): OpState {
  if (error instanceof ApiError) return { error: error.message };
  // reaisToCents lança Error com mensagem amigável para entrada inválida.
  if (error instanceof Error) return { error: error.message };
  return { error: fallback };
}

export async function depositAction(
  _prev: OpState,
  formData: FormData,
): Promise<OpState> {
  try {
    const amount = reaisToCents(String(formData.get('amount') ?? ''));
    await apiFetch('/transactions/deposit', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  } catch (error) {
    return toMessage(error, 'Não foi possível concluir o depósito.');
  }

  revalidatePath('/');
  return { success: 'Depósito realizado com sucesso.' };
}

export async function transferAction(
  _prev: OpState,
  formData: FormData,
): Promise<OpState> {
  try {
    const receiverId = String(formData.get('receiverId') ?? '');
    const amount = reaisToCents(String(formData.get('amount') ?? ''));
    await apiFetch('/transactions/transfer', {
      method: 'POST',
      body: JSON.stringify({ receiverId, amount }),
    });
  } catch (error) {
    return toMessage(error, 'Não foi possível concluir a transferência.');
  }

  revalidatePath('/');
  return { success: 'Transferência realizada com sucesso.' };
}

export async function reverseAction(
  _prev: OpState,
  formData: FormData,
): Promise<OpState> {
  try {
    const id = String(formData.get('id') ?? '');
    await apiFetch(`/transactions/${id}/reverse`, { method: 'POST' });
  } catch (error) {
    return toMessage(error, 'Não foi possível reverter a operação.');
  }

  revalidatePath('/');
  return { success: 'Operação revertida.' };
}

export async function logoutAction(): Promise<void> {
  await clearToken();
  redirect('/login');
}
