import { IsNumber, IsPositive } from 'class-validator';

export class DepositDto {
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'O valor deve ser um número com no máximo duas casas decimais.' },
  )
  @IsPositive({ message: 'O valor deve ser maior que zero.' })
  amount: number;
}
