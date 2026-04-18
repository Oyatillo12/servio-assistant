import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/** Maps a Telegram chat to a specific client and stores user preferences */
@Entity('chat_sessions')
@Unique(['chatId'])
export class ChatSession {
  @PrimaryGeneratedColumn()
  id: number;

  /** Telegram chat ID */
  @Column({ type: 'bigint' })
  chatId: number;

  /** The client this chat is linked to */
  @Column()
  clientId: number;

  /** User's preferred language */
  @Column({ type: 'varchar', length: 5, default: 'en' })
  lang: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
