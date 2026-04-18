import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity.js';
import { OrderItem } from './entities/order-item.entity.js';

export interface CreateOrderItemData {
  productId: number;
  productName: string;
  price: number | null;
  quantity: number;
}

export interface CreateOrderData {
  chatId: number;
  clientId: number;
  phone: string;
  address?: string;
  items: CreateOrderItemData[];
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly itemRepo: Repository<OrderItem>,
  ) {}

  async create(data: CreateOrderData): Promise<Order> {
    const order = this.orderRepo.create({
      chatId: data.chatId,
      clientId: data.clientId,
      phone: data.phone,
      address: data.address ?? null,
      status: 'pending',
      items: data.items.map((i) =>
        this.itemRepo.create({
          productId: i.productId,
          productName: i.productName,
          price: i.price,
          quantity: i.quantity,
        }),
      ),
    });

    const saved = await this.orderRepo.save(order);

    const itemSummary = data.items
      .map((i) => `${i.productName} x${i.quantity}`)
      .join(', ');
    this.logger.log(
      `Order #${saved.id} created — client: ${data.clientId}, items: ${itemSummary}`,
    );

    return saved;
  }

  async findByClient(clientId: number): Promise<Order[]> {
    return this.orderRepo.find({
      where: { clientId },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
  }

  async findRecent(clientId?: number): Promise<Order[]> {
    return this.orderRepo.find({
      where: clientId ? { clientId } : {},
      relations: ['items'],
      order: { createdAt: 'DESC' },
      take: 5,
    });
  }

  async findOne(id: number): Promise<Order | null> {
    return this.orderRepo.findOne({
      where: { id },
      relations: ['items'],
    });
  }

  async updateStatus(id: number, status: OrderStatus): Promise<void> {
    await this.orderRepo.update(id, { status });
  }

  async countByClient(clientId?: number): Promise<number> {
    return this.orderRepo.count(clientId ? { where: { clientId } } : {});
  }
}
