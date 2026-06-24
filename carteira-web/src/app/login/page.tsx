'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { ErrorAlert, SubmitButton, TextField } from '@/components/form';
import { loginAction, type AuthState } from './actions';

const initialState: AuthState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Entrar</h1>
        <p className="text-sm text-gray-500">Acesse sua carteira financeira.</p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <TextField label="E-mail" name="email" type="email" />
        <TextField label="Senha" name="password" type="password" />
        <ErrorAlert message={state.error} />
        <SubmitButton pending={pending} pendingLabel="Entrando...">
          Entrar
        </SubmitButton>
      </form>

      <p className="text-sm text-gray-600">
        Não tem conta?{' '}
        <Link href="/register" className="font-medium text-gray-900 underline">
          Criar conta
        </Link>
      </p>
    </main>
  );
}
