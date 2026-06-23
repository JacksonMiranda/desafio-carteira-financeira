import {
  BadRequestException,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    exceptionFactory: (errors) =>
      new BadRequestException({
        statusCode: 400,
        error: 'Requisição inválida',
        message: formatValidationErrors(errors),
      }),
  });
}

function formatValidationErrors(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => {
    const constraints = Object.entries(error.constraints ?? {}).map(
      ([constraint, message]) =>
        constraint === 'whitelistValidation'
          ? `O campo "${error.property}" não é permitido.`
          : message,
    );

    return [...constraints, ...formatValidationErrors(error.children ?? [])];
  });
}
