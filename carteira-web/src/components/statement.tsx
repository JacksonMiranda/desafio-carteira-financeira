import { formatCents } from '@/lib/money';
import type { Transaction } from '@/lib/types';
import { ReverseButton } from './reverse-button';

const TYPE_LABEL: Record<Transaction['type'], string> = {
  DEPOSIT: 'Depósito',
  TRANSFER: 'Transferência',
  REVERSAL: 'Estorno',
};

const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

// Estornos não podem ser revertidos, nem transações já revertidas.
function canReverse(tx: Transaction): boolean {
  return tx.type !== 'REVERSAL' && tx.status !== 'REVERSED';
}

export function Statement({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0) {
    return <p className="text-sm text-gray-500">Nenhuma transação ainda.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-gray-100">
      {transactions.map((tx) => {
        const isIn = tx.direction === 'IN';
        return (
          <li key={tx.id} className="flex items-center justify-between gap-4 py-3">
            <div className="flex flex-col">
              <span className="font-medium">{TYPE_LABEL[tx.type]}</span>
              <span className="text-xs text-gray-500">
                {dateFormat.format(new Date(tx.createdAt))}
                {tx.status === 'REVERSED' && ' · revertida'}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <span
                className={`font-semibold ${isIn ? 'text-green-700' : 'text-red-700'}`}
              >
                {isIn ? '+' : '−'} {formatCents(tx.amount)}
              </span>
              {canReverse(tx) && <ReverseButton transactionId={tx.id} />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
