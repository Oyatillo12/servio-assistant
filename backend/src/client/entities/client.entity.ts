import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from './product.entity.js';
import { Service } from './service.entity.js';

/** JSON shape for per-client Telegram bot UI configuration */
export interface BotConfig {
  welcomeMessage?: string;
  menuButtons?: {
    // Order-type client buttons
    products?: boolean;
    services?: boolean;
    order?: boolean;
    aiChat?: boolean;
    // Lead-type client buttons
    about?: boolean;
    prices?: boolean;
    // Shared
    contact?: boolean;
    language?: boolean;
  };
  buttonIcons?: {
    products?: string;
    services?: string;
    order?: string;
    aiChat?: string;
    about?: string;
    prices?: string;
    contact?: string;
    language?: string;
  };
  contactPhone?: string;
  contactWebsite?: string;
}

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  /** Unique slug used in Telegram deep links: /start <slug> */
  @Column({ unique: true })
  slug: string;

  @Column({ type: 'text' })
  systemPrompt: string;

  @Column({ default: true })
  isActive: boolean;

  /** Flow type: 'order' for shops/restaurants, 'lead' for education/clinics */
  @Column({ type: 'varchar', length: 10, default: 'lead' })
  type: 'order' | 'lead';

  /** Currency used by this client */
  @Column({ type: 'varchar', length: 3, default: 'UZS' })
  currency: 'UZS' | 'USD' | 'RUB';

  /** Telegram chat ID to send admin notifications to */
  @Column({ type: 'bigint', nullable: true, default: null })
  adminChatId: number | null;

  /** Whether this client uses the Products feature */
  @Column({ default: true })
  hasProducts: boolean;

  /** Whether this client uses the Services feature */
  @Column({ default: true })
  hasServices: boolean;

  /** Default language for bot responses: 'uz' | 'ru' | 'en' */
  @Column({ type: 'varchar', length: 5, default: 'uz' })
  defaultLang: 'uz' | 'ru' | 'en';

  /**
   * Optional dedicated Telegram bot token for this client.
   * When null, the client shares the general bot (via slug deeplink).
   * NOTE: stored plaintext; production should encrypt at rest.
   */
  @Column({ type: 'varchar', nullable: true, default: null })
  botToken: string | null;

  /** Dedicated bot's @username (derived from Telegram getMe on token save) */
  @Column({ type: 'varchar', nullable: true, default: null })
  botUsername: string | null;

  /** LLM provider routing choice: 'gemini' (default) or 'openai' */
  @Column({ type: 'varchar', length: 16, default: 'gemini' })
  aiProvider: 'gemini' | 'openai';

  /** Model identifier for the selected provider (e.g. gpt-4o-mini, gemini-2.5-flash) */
  @Column({ type: 'varchar', length: 64, nullable: true, default: null })
  aiModel: string | null;

  /** Per-client Telegram bot UI configuration (JSON) */
  @Column({ type: 'text', nullable: true, default: null })
  botConfig: string | null;

  @OneToMany(() => Product, (p) => p.client, { cascade: true })
  products: Product[];

  @OneToMany(() => Service, (s) => s.client, { cascade: true })
  services: Service[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /** Helper to get parsed bot config */
  get parsedBotConfig(): BotConfig {
    if (!this.botConfig) return {};
    try {
      return JSON.parse(this.botConfig) as BotConfig;
    } catch {
      return {};
    }
  }
}
