// A API trabalha em centavos (inteiros, serializados como string por causa do
// BigInt). A UI exibe em reais e recebe reais do usuário, então a conversão
// fica concentrada aqui.

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

// Formata um valor em centavos (string vinda da API ou number) como R$.
export function formatCents(cents: string | number | bigint): string {
  const value = Number(cents) / 100;
  return BRL.format(value);
}

// Converte um valor em reais digitado pelo usuário para centavos inteiros.
// Lança se a entrada não for um número válido e positivo.
export function reaisToCents(reais: string | number): number {
  const value = typeof reais === 'string' ? Number(reais.replace(',', '.')) : reais;

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Informe um valor válido maior que zero.');
  }

  return Math.round(value * 100);
}
