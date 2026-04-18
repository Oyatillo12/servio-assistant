import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type LeadStatus = 'new' | 'contacted' | 'closed';

@Entity('leads')
@Index(['chatId', 'clientId'])
export class Lead {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'bigint' })
  chatId: number;

  @Column()
  clientId: number;

  @Column()
  name: string;

  @Column()
  phone: string;

  /** AI conversation summary or user's original question */
  @Column({ type: 'text', nullable: true, default: null })
  notes: string | null;

  @Column({ type: 'varchar', length: 20, default: 'new' })
  status: LeadStatus;

  @CreateDateColumn()
  createdAt: Date;
}
