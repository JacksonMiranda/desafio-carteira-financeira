// JSON.stringify não sabe serializar BigInt e lançaria um erro em tempo de
// execução. Como os valores monetários são persistidos em centavos (BigInt),
// garantimos que qualquer BigInt vire string na resposta, em vez de derrubar
// a requisição com um erro 500.
declare global {
  interface BigInt {
    toJSON(): string;
  }
}

BigInt.prototype.toJSON = function (): string {
  return this.toString();
};

export {};
