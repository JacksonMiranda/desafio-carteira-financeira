'use client';

import { useActionState } from 'react';
import { reverseAction, type OpState } from '@/app/actions';

const initialState: OpState = {};

export function ReverseButton({ transactionId }: { transactionId: string }) {
  const [state, formAction, pending] = useActionState(
    reverseAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={transactionId} />
      <button
        type="submit"
        disabled={pending}
        className="text-sm font-medium text-gray-700 underline disabled:opacity-50"
      >
        {pending ? 'Revertendo...' : 'Reverter'}
      </button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
