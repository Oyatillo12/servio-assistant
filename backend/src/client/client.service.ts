import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from './entities/client.entity.js';
import { Product } from './entities/product.entity.js';
import { Service } from './entities/service.entity.js';
import { CreateClientDto } from './dto/create-client.dto.js';
import { UpdateClientDto } from './dto/update-client.dto.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { CreateServiceDto } from './dto/create-service.dto.js';
import { UpdateServiceDto } from './dto/update-service.dto.js';
import { AuthService } from '../auth/auth.service.js';
import { Role } from '../auth/entities/user.entity.js';
import { getDemoPreset, type DemoType, type DemoLang } from './demo-presets.js';
import { formatPrice } from '../common/utils/currency.util.js';
import { BotRegistry } from '../bot/bot-registry.service.js';
import { validateBotToken } from '../bot/telegram-token-validator.js';

@Injectable()
export class ClientService {
  private readonly logger = new Logger(ClientService.name);

  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
    @Inject(forwardRef(() => BotRegistry))
    private readonly botRegistry: BotRegistry,
  ) {}

  // ── Clients ──────────────────────────────────────────────

  async findAll(): Promise<Client[]> {
    return this.clientRepo.find({ relations: ['products', 'services'] });
  }

  async findOne(id: number): Promise<Client> {
    const client = await this.clientRepo.findOne({
      where: { id },
      relations: ['products', 'services'],
    });
    if (!client) throw new NotFoundException(`Client #${id} not found`);
    return client;
  }

  async findBySlug(slug: string): Promise<Client | null> {
    return this.clientRepo.findOne({
      where: { slug, isActive: true },
      relations: ['products', 'services'],
    });
  }

  async create(dto: CreateClientDto): Promise<Client> {
    const { adminCredentials, botConfig, ...clientData } = dto;

    // Serialize botConfig to JSON string
    const toSave = {
      ...clientData,
      botConfig: botConfig ? JSON.stringify(botConfig) : null,
    };

    const client = this.clientRepo.create(toSave);
    const saved = await this.clientRepo.save(client);

    // Auto-create client_admin user if credentials provided
    if (adminCredentials) {
      try {
        await this.authService.createUser({
          login: adminCredentials.login,
          password: adminCredentials.password,
          role: Role.CLIENT_ADMIN,
          clientId: saved.id,
        });
        this.logger.log(
          `Client admin created: ${adminCredentials.login} for client #${saved.id}`,
        );
      } catch (err: unknown) {
        this.logger.warn(
          `Failed to create client admin for client #${saved.id}: ${(err as Error).message}`,
        );
      }
    }

    return this.findOne(saved.id);
  }

  /** Fields only SUPER_ADMIN may modify. */
  private static readonly SUPER_ADMIN_ONLY_FIELDS = [
    'type',
    'currency',
    'defaultLang',
    'hasProducts',
    'hasServices',
  ] as const;

  async update(
    id: number,
    dto: UpdateClientDto,
    actorRole: Role = Role.SUPER_ADMIN,
  ): Promise<Client> {
    const client = await this.findOne(id);
    const { botConfig, botToken, ...rest } = dto;

    if (actorRole !== Role.SUPER_ADMIN) {
      for (const field of ClientService.SUPER_ADMIN_ONLY_FIELDS) {
        if (field in rest) {
          this.logger.warn(
            `Non-super-admin attempted to change locked field "${field}" on client #${id}; ignoring`,
          );
          delete (rest as Record<string, unknown>)[field];
        }
      }
    }

    Object.assign(client, rest);
    if (botConfig !== undefined) {
      client.botConfig = botConfig ? JSON.stringify(botConfig) : null;
    }

    // Handle dedicated-bot token change
    let reconcileBot = false;
    if (botToken !== undefined) {
      const next = botToken?.trim() || null;
      if (next !== client.botToken) {
        if (next) {
          const identity = await validateBotToken(next);
          client.botToken = next;
          client.botUsername = identity.username;
        } else {
          client.botToken = null;
          client.botUsername = null;
        }
        reconcileBot = true;
      }
    }

    const saved = await this.clientRepo.save(client);

    if (reconcileBot) {
      try {
        await this.botRegistry.reconcileClient(saved);
      } catch (err) {
        this.logger.error(
          `Bot reconciliation failed for client #${id}: ${(err as Error).message}`,
        );
      }
    }

    return saved;
  }

  async remove(id: number): Promise<void> {
    const client = await this.findOne(id);
    try {
      await this.botRegistry.unregisterClient(id);
    } catch {
      // best-effort: continue deletion even if bot teardown fails
    }
    await this.clientRepo.remove(client);
  }

  // ── Demo seed ────────────────────────────────────────────

  /**
   * One-click demo client with realistic seed data.
   * Generates a unique slug so it can be called multiple times without collision.
   */
  async createDemo(type: DemoType, lang: DemoLang = 'en'): Promise<Client> {
    const preset = getDemoPreset(type, lang);
    const rand = Math.random().toString(36).slice(2, 6);
    const baseSlug = `demo-${type}-${rand}`;

    // Ensure both name and slug are unique
    const name = `${preset.name} #${rand}`;
    let slug = baseSlug;
    let i = 1;
    while (await this.clientRepo.findOne({ where: { slug } })) {
      slug = `${baseSlug}-${i++}`;
    }

    const client = this.clientRepo.create({
      name,
      slug,
      systemPrompt: preset.systemPrompt,
      type,
      defaultLang: lang,
      currency: preset.currency,
      hasProducts: true,
      hasServices: true,
      isActive: true,
      botConfig: JSON.stringify({ welcomeMessage: preset.welcomeMessage }),
    });
    const saved = await this.clientRepo.save(client);

    // Seed products + services
    await this.productRepo.save(
      preset.products.map((p) =>
        this.productRepo.create({ ...p, clientId: saved.id }),
      ),
    );
    await this.serviceRepo.save(
      preset.services.map((s) =>
        this.serviceRepo.create({ ...s, clientId: saved.id }),
      ),
    );

    this.logger.log(
      `Demo client created: ${name} (${type}/${lang}), ${preset.products.length} products, ${preset.services.length} services`,
    );

    return this.findOne(saved.id);
  }

  // ── Products ─────────────────────────────────────────────

  async addProduct(clientId: number, dto: CreateProductDto): Promise<Product> {
    await this.findOne(clientId); // ensure client exists
    const product = this.productRepo.create({ ...dto, clientId });
    return this.productRepo.save(product);
  }

  async updateProduct(
    productId: number,
    dto: UpdateProductDto,
  ): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { id: productId },
    });
    if (!product)
      throw new NotFoundException(`Product #${productId} not found`);
    Object.assign(product, dto);
    return this.productRepo.save(product);
  }

  async removeProduct(productId: number): Promise<void> {
    await this.productRepo.delete(productId);
  }

  // ── Services ─────────────────────────────────────────────

  async addService(clientId: number, dto: CreateServiceDto): Promise<Service> {
    await this.findOne(clientId);
    const service = this.serviceRepo.create({ ...dto, clientId });
    return this.serviceRepo.save(service);
  }

  async updateService(
    serviceId: number,
    dto: UpdateServiceDto,
  ): Promise<Service> {
    const service = await this.serviceRepo.findOne({
      where: { id: serviceId },
    });
    if (!service)
      throw new NotFoundException(`Service #${serviceId} not found`);
    Object.assign(service, dto);
    return this.serviceRepo.save(service);
  }

  async removeService(serviceId: number): Promise<void> {
    await this.serviceRepo.delete(serviceId);
  }

  // ── Prompt Builder ───────────────────────────────────────

  /** Build the full system prompt for a client, including products, services, and language */
  buildPrompt(client: Client, lang = 'en'): string {
    const langNames: Record<string, string> = {
      uz: 'Uzbek',
      ru: 'Russian',
      en: 'English',
    };
    const langName = langNames[lang] ?? 'English';

    let prompt = client.systemPrompt;
    prompt += `\n\nIMPORTANT: Always respond in ${langName}. Keep responses concise and suitable for Telegram chat (under 300 words).`;

    const activeProducts = client.products?.filter((p) => p.isActive) ?? [];
    if (activeProducts.length > 0) {
      prompt += '\n\nOur products:\n';
      for (const p of activeProducts) {
        prompt += `- ${p.name}`;
        if (p.description) prompt += `: ${p.description}`;
        if (p.price != null) prompt += ` (${formatPrice(p.price, client.currency)})`;
        prompt += '\n';
      }
    }

    const activeServices = client.services?.filter((s) => s.isActive) ?? [];
    if (activeServices.length > 0) {
      prompt += '\nOur services:\n';
      for (const s of activeServices) {
        prompt += `- ${s.name}`;
        if (s.description) prompt += `: ${s.description}`;
        if (s.price != null) prompt += ` (${formatPrice(s.price, client.currency)})`;
        prompt += '\n';
      }
    }

    return prompt;
  }
}
