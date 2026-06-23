import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt-payload.type';
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
}
