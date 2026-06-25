import './common/bigint.serializer';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { createValidationPipe } from './common/pipes/validation.pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(createValidationPipe());

  // Documentação interativa em /docs. addBearerAuth permite testar as rotas
  // protegidas colando o JWT direto na UI do Swagger.
  const config = new DocumentBuilder()
    .setTitle('Carteira Financeira API')
    .setDescription(
      'Cadastro, autenticação e operações de carteira (depósito, transferência e reversão).',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
