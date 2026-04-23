import { BadRequestException } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';

export interface TelegramBotIdentity {
  id: number;
  username: string;
  firstName: string;
}

/**
 * Verify a Telegram bot token by calling getMe().
 * Throws BadRequestException with a safe message if the token is invalid.
 * Creates a short-lived bot instance (no polling) just for the check.
 */
export async function validateBotToken(
  token: string,
): Promise<TelegramBotIdentity> {
  const trimmed = token.trim();
  if (!trimmed || !/^\d+:[A-Za-z0-9_-]{20,}$/.test(trimmed)) {
    throw new BadRequestException('Invalid bot token format');
  }

  const probe = new TelegramBot(trimmed, { polling: false });
  try {
    const me = await probe.getMe();
    if (!me.username) {
      throw new BadRequestException('Bot has no username');
    }
    return {
      id: me.id,
      username: me.username,
      firstName: me.first_name,
    };
  } catch (err) {
    if (err instanceof BadRequestException) throw err;
    throw new BadRequestException(
      `Telegram rejected the token: ${(err as Error).message}`,
    );
  }
}
