// Valores monetários são armazenados em centavos (BigInt) para evitar
// imprecisão de ponto flutuante. A API recebe e expõe os valores em reais.

export function reaisToCents(reais: number): bigint {
  return BigInt(Math.round(reais * 100));
}

export function centsToReais(cents: bigint): number {
  return Number(cents) / 100;
}
