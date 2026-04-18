import { Injectable, Logger } from '@nestjs/common';
import type TelegramBot from 'node-telegram-bot-api';

// ── Flow types ──────────────────────────────────────────────
export type FlowType = 'order' | 'lead';

// ── Cart item shape ─────────────────────────────────────────
export interface CartItem {
  productId: number;
  productName: string;
  price: number | null;
  quantity: number;
}

// ── Order flow steps ────────────────────────────────────────
export enum OrderStep {
  SELECT_PRODUCT = 'order_select_product',
  ENTER_QUANTITY = 'order_enter_quantity',
  CART_REVIEW = 'order_cart_review',
  ENTER_PHONE = 'order_enter_phone',
  ENTER_ADDRESS = 'order_enter_address',
  CONFIRM = 'order_confirm',
}

// ── Lead flow steps ─────────────────────────────────────────
export enum LeadStep {
  AI_CHAT = 'lead_ai_chat',
  ENTER_NAME = 'lead_enter_name',
  ENTER_PHONE = 'lead_enter_phone',
  CONFIRM = 'lead_confirm',
}

export type FlowStep = OrderStep | LeadStep;

// ── State shape ─────────────────────────────────────────────
export interface FlowState {
  flowType: FlowType;
  step: FlowStep;
  /** Accumulated user input data during the flow */
  data: Record<string, unknown>;
  /** Cart items for order flow */
  cart: CartItem[];
  /** ID of the last bot message (for editing instead of sending new) */
  messageId?: number;
  /** Client ID the flow is running for */
  clientId: number;
  /** Timestamp for TTL cleanup */
  updatedAt: number;
}

const STATE_TTL_MS = 30 * 60 * 1000; // 30 minutes

@Injectable()
export class FlowStateService {
  private readonly logger = new Logger(FlowStateService.name);
  private readonly states = new Map<number, FlowState>();

  // ── Getters ─────────────────────────────────────────────

  getState(chatId: number): FlowState | undefined {
    const state = this.states.get(chatId);
    if (state && Date.now() - state.updatedAt > STATE_TTL_MS) {
      this.states.delete(chatId);
      return undefined;
    }
    return state;
  }

  isInFlow(chatId: number): boolean {
    return this.getState(chatId) !== undefined;
  }

  getFlowType(chatId: number): FlowType | undefined {
    return this.getState(chatId)?.flowType;
  }

  getStep(chatId: number): FlowStep | undefined {
    return this.getState(chatId)?.step;
  }

  getData<T = unknown>(chatId: number, key: string): T | undefined {
    return this.getState(chatId)?.data[key] as T | undefined;
  }

  // ── Cart helpers ────────────────────────────────────────

  getCart(chatId: number): CartItem[] {
    return this.getState(chatId)?.cart ?? [];
  }

  addToCart(chatId: number, item: CartItem): void {
    const state = this.getState(chatId);
    if (!state) return;

    const existing = state.cart.find((c) => c.productId === item.productId);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      state.cart.push(item);
    }
    state.updatedAt = Date.now();
  }

  removeFromCart(chatId: number, productId: number): void {
    const state = this.getState(chatId);
    if (!state) return;
    state.cart = state.cart.filter((c) => c.productId !== productId);
    state.updatedAt = Date.now();
  }

  clearCart(chatId: number): void {
    const state = this.getState(chatId);
    if (!state) return;
    state.cart = [];
    state.updatedAt = Date.now();
  }

  // ── Mutations ───────────────────────────────────────────

  startFlow(
    chatId: number,
    flowType: FlowType,
    firstStep: FlowStep,
    clientId: number,
  ): FlowState {
    const state: FlowState = {
      flowType,
      step: firstStep,
      data: {},
      cart: [],
      clientId,
      updatedAt: Date.now(),
    };
    this.states.set(chatId, state);
    this.logger.debug(`Chat ${chatId} → ${flowType} flow started`);
    return state;
  }

  setStep(chatId: number, step: FlowStep): void {
    const state = this.getState(chatId);
    if (!state) return;
    state.step = step;
    state.updatedAt = Date.now();
    this.logger.debug(`Chat ${chatId} → step: ${step}`);
  }

  updateData(chatId: number, key: string, value: unknown): void {
    const state = this.getState(chatId);
    if (!state) return;
    state.data[key] = value;
    state.updatedAt = Date.now();
  }

  setMessageId(chatId: number, messageId: number): void {
    const state = this.getState(chatId);
    if (!state) return;
    state.messageId = messageId;
  }

  getMessageId(chatId: number): number | undefined {
    return this.getState(chatId)?.messageId;
  }

  clearState(chatId: number): void {
    this.states.delete(chatId);
    this.logger.debug(`Chat ${chatId} → flow cleared`);
  }

  // ── UX helpers ──────────────────────────────────────────

  /**
   * Strip inline buttons from the tracked bot message.
   * Call this when the user sends text — the old buttons become stale.
   */
  async stripOldButtons(chatId: number, bot: TelegramBot): Promise<void> {
    const msgId = this.getMessageId(chatId);
    if (!msgId) return;
    try {
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        { chat_id: chatId, message_id: msgId },
      );
    } catch {
      // Message may be too old or already edited — safe to ignore
    }
  }

  /**
   * Delete the tracked bot message entirely.
   * Use when you need a completely clean slate (e.g. after confirm/cancel).
   */
  async deleteTrackedMessage(chatId: number, bot: TelegramBot): Promise<void> {
    const msgId = this.getMessageId(chatId);
    if (!msgId) return;
    try {
      await bot.deleteMessage(chatId, msgId);
    } catch {
      // Already deleted or too old — safe to ignore
    }
  }
}
