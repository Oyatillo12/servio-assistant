import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { BotRegistry } from './bot-registry.service.js';

/**
 * Endpoints Telegram POSTs bot updates to when webhook mode is enabled
 * (i.e. when `PUBLIC_URL` is set). The secret_token we gave to setWebHook
 * comes back in `X-Telegram-Bot-Api-Secret-Token` — BotRegistry verifies it
 * with a timing-safe compare.
 *
 * When `PUBLIC_URL` is unset, the bots run in polling mode and these
 * endpoints simply won't receive anything (and would reject anything they
 * did receive because no secret is registered).
 */
@Controller('api/telegram/webhook')
export class TelegramWebhookController {
  constructor(private readonly registry: BotRegistry) {}

  @Post('general')
  @HttpCode(200)
  general(
    @Body() body: unknown,
    @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
  ): { ok: true } {
    this.feed('general', body, secret);
    return { ok: true };
  }

  @Post('client/:clientId')
  @HttpCode(200)
  client(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Body() body: unknown,
    @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
  ): { ok: true } {
    this.feed(clientId, body, secret);
    return { ok: true };
  }

  private feed(
    key: 'general' | number,
    body: unknown,
    secret: string | undefined,
  ): void {
    if (!secret) throw new ForbiddenException();
    const accepted = this.registry.processUpdate(key, body, secret);
    if (!accepted) {
      // Don't leak whether the bot exists vs the secret was wrong — 404 in both
      // cases. Telegram retries 5xx (we don't want that), so always 2xx/4xx.
      throw new NotFoundException();
    }
  }
}
