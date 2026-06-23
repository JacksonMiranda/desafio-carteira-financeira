import { IsEmail, IsNumber, IsPositive } from 'class-validator';

export class TransferDto {
  @IsEmail({}, { message: 'O e-mail do destinatário deve ser válido.' })
  receiverEmail: string;

  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'O valor deve ser um número com no máximo duas casas decimais.' },
  )
  @IsPositive({ message: 'O valor deve ser maior que zero.' })
  amount: number;
}
