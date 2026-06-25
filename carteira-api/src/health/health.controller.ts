import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness/readiness: verifica a conexão com o banco.' })
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      // 503 para orquestradores (Docker/k8s) tratarem como indisponível.
      throw new ServiceUnavailableException({ status: 'error', db: 'down' });
    }

    return { status: 'ok', db: 'up' };
  }
}
