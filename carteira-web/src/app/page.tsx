import { redirect } from 'next/navigation';
import { ApiError, apiFetch } from '@/lib/api';
import { formatCents } from '@/lib/money';
import type { Balance, Transaction } from '@/lib/types';
import { DepositForm } from '@/components/deposit-form';
import { TransferForm } from '@/components/transfer-form';
import { Statement } from '@/components/statement';
import { LogoutButton } from '@/components/logout-button';

export default async function DashboardPage() {
  let balance: Balance;
  let transactions: Transaction[];

  try {
    [balance, transactions] = await Promise.all([
      apiFetch<Balance>('/transactions/balance'),
      apiFetch<Transaction[]>('/transactions'),
    ]);
  } catch (error) {
    // Token expirado/inválido: volta ao login em vez de quebrar a página.
    if (error instanceof ApiError && error.status === 401) {
      redirect('/login');
    }
    throw error;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Minha carteira</h1>
        <LogoutButton />
      </header>

      <section className="rounded-xl bg-gray-900 p-6 text-white">
        <p className="text-sm text-gray-300">Saldo disponível</p>
        <p className="text-3xl font-bold">{formatCents(balance.balance)}</p>
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 p-5">
          <DepositForm />
        </div>
        <div className="rounded-xl border border-gray-200 p-5">
          <TransferForm />
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 p-5">
        <h2 className="mb-2 font-semibold">Extrato</h2>
        <Statement transactions={transactions} />
      </section>
    </main>
  );
}
