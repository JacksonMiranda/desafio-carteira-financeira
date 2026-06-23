import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt-payload.type';
import { DepositDto } from './dto/deposit.dto';
import { TransferDto } from './dto/transfer.dto';
import { WalletService } from './wallet.service';

@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  getBalance(@CurrentUser() user: AuthenticatedUser) {
    return this.walletService.getBalance(user.userId);
  }

  @Get('transactions')
  getStatement(@CurrentUser() user: AuthenticatedUser) {
    return this.walletService.getStatement(user.userId);
  }

  @Post('deposit')
  deposit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() depositDto: DepositDto,
  ) {
    return this.walletService.deposit(user.userId, depositDto.amount);
  }

  @Post('transfer')
  transfer(
    @CurrentUser() user: AuthenticatedUser,
    @Body() transferDto: TransferDto,
  ) {
    return this.walletService.transfer(
      user.userId,
      transferDto.receiverEmail,
      transferDto.amount,
    );
  }

  @Post('transactions/:id/reverse')
  reverse(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.walletService.reverse(user.userId, id);
  }
}
