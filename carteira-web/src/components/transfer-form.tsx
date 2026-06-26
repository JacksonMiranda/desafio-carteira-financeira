'use client';

import { useActionState } from 'react';
import { transferAction, type OpState } from '@/app/actions';
import { ErrorAlert, SubmitButton, TextField } from './form';
import { RecipientPicker } from './recipient-picker';

const initialState: OpState = {};

export function TransferForm() {
  const [state, formAction, pending] = useActionState(
    transferAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <h2 className="font-semibold">Transferir</h2>
      <RecipientPicker />
      <TextField
        label="Valor (R$)"
        name="amount"
        type="number"
        step="0.01"
        min="0.01"
        placeholder="0,00"
      />
      <ErrorAlert message={state.error} />
      {state.success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          {state.success}
        </p>
      )}
      <SubmitButton pending={pending} pendingLabel="Transferindo...">
        Transferir
      </SubmitButton>
    </form>
  );
}
