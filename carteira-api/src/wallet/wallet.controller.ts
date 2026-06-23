import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt-payload.type';
import { DepositDto } from './dto/deposit.dto';
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
}
