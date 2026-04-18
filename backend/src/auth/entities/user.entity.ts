import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum Role {
  SUPER_ADMIN = 'super_admin',
  CLIENT_ADMIN = 'client_admin',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  /** Unique login handle used for authentication */
  @Column({ unique: true })
  login: string;

  /** Optional email address */
  @Column({ type: 'varchar', nullable: true, default: null })
  email: string | null;

  /** Optional phone number */
  @Column({ type: 'varchar', nullable: true, default: null })
  phone: string | null;

  @Column()
  password: string;

  @Column({ type: 'varchar', default: Role.CLIENT_ADMIN })
  role: Role;

  /** If client_admin, which client they manage (null for super_admin) */
  @Column({ type: 'integer', nullable: true, default: null })
  clientId?: number | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
