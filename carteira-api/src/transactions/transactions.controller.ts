import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt-payload.type';
import { DepositDto } from './dto/deposit.dto';
import { TransferDto } from './dto/transfer.dto';
import { TransactionsService } from './transactions.service';

@ApiTags('transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post('deposit')
  @ApiOperation({ summary: 'Deposita um valor (em centavos) na carteira.' })
  deposit(@CurrentUser() user: AuthenticatedUser, @Body() dto: DepositDto) {
    return this.transactionsService.deposit(user.userId, dto.amount);
  }

  @Post('transfer')
  @ApiOperation({ summary: 'Transfere um valor para outro usuário.' })
  transfer(@CurrentUser() user: AuthenticatedUser, @Body() dto: TransferDto) {
    return this.transactionsService.transfer(
      user.userId,
      dto.receiverId,
      dto.amount,
    );
  }

  @Post(':id/reverse')
  @ApiOperation({ summary: 'Reverte uma transação (depósito ou transferência).' })
  reverse(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.transactionsService.reverse(user.userId, id);
  }

  @Get('balance')
  @ApiOperation({ summary: 'Consulta o saldo atual da carteira (em centavos).' })
  getBalance(@CurrentUser() user: AuthenticatedUser) {
    return this.transactionsService.getBalance(user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Lista o histórico de transações do usuário.' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.transactionsService.findAllByUser(user.userId);
  }
}
