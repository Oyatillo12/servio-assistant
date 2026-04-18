import 'reflect-metadata';
import { DataSource } from 'typeorm';

/**
 * TypeORM DataSource for the CLI (migration:run / migration:generate).
 *
 * Run via:  pnpm migration:run   (compiles first, then invokes typeorm CLI)
 *
 * Entities and migrations resolve from compiled dist/ output —
 * always run `pnpm build` (or let the migration scripts do it) before
 * running any migration command.
 *
 * Environment variables are loaded from .env automatically by the npm
 * scripts via `--require dotenv/config`.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'ai_bot',
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/database/migrations/*.js'],
  synchronize: false,
  logging: ['migration'],
});
