import { IsInt, Min } from 'class-validator';

export class DepositDto {
  @IsInt({ message: 'O valor deve ser um número inteiro (em centavos).' })
  @Min(1, { message: 'O valor deve ser maior que zero.' })
  amount: number;
}
