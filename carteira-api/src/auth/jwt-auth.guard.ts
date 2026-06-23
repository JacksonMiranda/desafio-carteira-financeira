import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedUser } from './jwt-payload.type';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = AuthenticatedUser>(
    error: unknown,
    user: TUser | false | null,
  ): TUser {
    if (error || !user) {
      throw new UnauthorizedException('Não autorizado.');
    }

    return user;
  }
}
