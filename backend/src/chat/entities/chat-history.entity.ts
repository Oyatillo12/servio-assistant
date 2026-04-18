import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('chat_history')
@Index(['chatId', 'clientId'])
export class ChatHistory {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'bigint' })
  chatId!: number;

  @Column()
  clientId!: number;

  @Column({ type: 'varchar', length: 10 })
  role!: 'user' | 'assistant';

  @Column({ type: 'text' })
  message!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
