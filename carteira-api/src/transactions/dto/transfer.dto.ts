import { IsInt, IsUUID, Min } from 'class-validator';

export class TransferDto {
  @IsUUID('4', {
    message: 'O identificador do destinatário deve ser um UUID válido.',
  })
  receiverId: string;

  @IsInt({ message: 'O valor deve ser um número inteiro (em centavos).' })
  @Min(1, { message: 'O valor deve ser maior que zero.' })
  amount: number;
}
