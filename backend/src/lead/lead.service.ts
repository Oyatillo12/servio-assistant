import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead, LeadStatus } from './entities/lead.entity.js';

export interface CreateLeadData {
  chatId: number;
  clientId: number;
  name: string;
  phone: string;
  notes?: string;
}

@Injectable()
export class LeadService {
  private readonly logger = new Logger(LeadService.name);

  constructor(
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
  ) {}

  async create(data: CreateLeadData): Promise<Lead> {
    const lead = this.leadRepo.create({
      ...data,
      notes: data.notes ?? null,
      status: 'new',
    });
    const saved = await this.leadRepo.save(lead);
    this.logger.log(
      `Lead #${saved.id} created — client: ${data.clientId}, name: ${data.name}`,
    );
    return saved;
  }

  async findByClient(clientId: number): Promise<Lead[]> {
    return this.leadRepo.find({
      where: { clientId },
      order: { createdAt: 'DESC' },
    });
  }

  async findRecent(clientId?: number): Promise<Lead[]> {
    return this.leadRepo.find({
      where: clientId ? { clientId } : {},
      order: { createdAt: 'DESC' },
      take: 5,
    });
  }

  async findOne(id: number): Promise<Lead | null> {
    return this.leadRepo.findOne({ where: { id } });
  }

  async updateStatus(id: number, status: LeadStatus): Promise<void> {
    await this.leadRepo.update(id, { status });
  }

  async countByClient(clientId?: number): Promise<number> {
    return this.leadRepo.count(clientId ? { where: { clientId } } : {});
  }
}
