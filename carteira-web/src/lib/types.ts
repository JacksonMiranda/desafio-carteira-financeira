// Espelham as respostas da carteira-api. Valores monetários chegam como string
// (BigInt serializado).

export type TransactionType = 'DEPOSIT' | 'TRANSFER' | 'REVERSAL';
export type TransactionStatus = 'COMPLETED' | 'REVERSED';

export type Transaction = {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: string;
  senderWalletId: string | null;
  receiverWalletId: string | null;
  relatedTransactionId: string | null;
  createdAt: string;
  direction: 'IN' | 'OUT';
};

export type Balance = { balance: string };
