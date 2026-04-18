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

  async update(id: number, dto: UpdateClientDto): Promise<Client> {
    const client = await this.findOne(id);
    const { botConfig, ...rest } = dto;
    Object.assign(client, rest);
    if (botConfig !== undefined) {
      client.botConfig = botConfig ? JSON.stringify(botConfig) : null;
    }
    return this.clientRepo.save(client);
  }

  async remove(id: number): Promise<void> {
    const client = await this.findOne(id);
    await this.clientRepo.remove(client);
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
        if (p.price != null) prompt += ` ($${p.price})`;
        prompt += '\n';
      }
    }

    const activeServices = client.services?.filter((s) => s.isActive) ?? [];
    if (activeServices.length > 0) {
      prompt += '\nOur services:\n';
      for (const s of activeServices) {
        prompt += `- ${s.name}`;
        if (s.description) prompt += `: ${s.description}`;
        prompt += '\n';
      }
    }

    return prompt;
  }
}
