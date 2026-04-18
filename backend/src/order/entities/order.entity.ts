import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrderItem } from './order-item.entity.js';

export type OrderStatus = 'pending' | 'confirmed' | 'cancelled';

@Entity('orders')
@Index(['chatId', 'clientId'])
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'bigint' })
  chatId: number;

  @Column()
  clientId: number;

  @OneToMany(() => OrderItem, (i) => i.order, { cascade: true, eager: true })
  items: OrderItem[];

  @Column()
  phone: string;

  @Column({ type: 'text', nullable: true, default: null })
  address: string | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: OrderStatus;

  @CreateDateColumn()
  createdAt: Date;
}
