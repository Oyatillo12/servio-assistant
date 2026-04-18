import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Client } from './client.entity.js';

@Entity('services')
export class Service {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price: number | null;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => Client, (c) => c.services, { onDelete: 'CASCADE' })
  client: Client;

  @Column()
  clientId: number;
}
