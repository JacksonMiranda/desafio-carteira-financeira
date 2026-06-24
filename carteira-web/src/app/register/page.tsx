'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { ErrorAlert, SubmitButton, TextField } from '@/components/form';
import type { AuthState } from '../login/actions';
import { registerAction } from './actions';

const initialState: AuthState = {};

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(
    registerAction,
    initialState,
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Criar conta</h1>
        <p className="text-sm text-gray-500">
          Cadastre-se para usar a carteira financeira.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <TextField label="Nome" name="name" />
        <TextField label="E-mail" name="email" type="email" />
        <TextField label="Senha" name="password" type="password" />
        <ErrorAlert message={state.error} />
        <SubmitButton pending={pending} pendingLabel="Criando...">
          Criar conta
        </SubmitButton>
      </form>

      <p className="text-sm text-gray-600">
        Já tem conta?{' '}
        <Link href="/login" className="font-medium text-gray-900 underline">
          Entrar
        </Link>
      </p>
    </main>
  );
}
