import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

/**
 * Parse ALLOWED_ORIGINS env into the shape enableCors / socket.io expect.
 *   - unset, empty, or "*" → reflect the requesting origin (safe with credentials:true).
 *   - comma-separated list → allow just those origins.
 * Kept in one place so HTTP CORS and the WebSocket gateway stay aligned.
 */
export function parseAllowedOrigins(value: string | undefined) {
  const trimmed = (value ?? '').trim();
  if (!trimmed || trimmed === '*') return true as const;
  return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
    credentials: true,
  });
  app.enableShutdownHooks();

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  Logger.log(`Server running on http://localhost:${port}`, 'Bootstrap');
}
void bootstrap();
