import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: LoginAndDefaultLang
 *
 * Changes:
 *  users  — add `login` (unique), `phone`, `is_active`; make `email` nullable
 *  clients — add `default_lang`
 */
export class LoginAndDefaultLang1744800000000 implements MigrationInterface {
  name = 'LoginAndDefaultLang1744800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── users: add login (nullable first, then backfill, then set NOT NULL) ──
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "login" VARCHAR
    `);

    // Backfill login from email for existing rows so NOT NULL doesn't fail
    await queryRunner.query(`
      UPDATE "users" SET "login" = "email" WHERE "login" IS NULL
    `);

    // Now enforce NOT NULL + UNIQUE
    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "login" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD CONSTRAINT "UQ_users_login" UNIQUE ("login")
    `);

    // ── users: make email nullable ──
    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "email" DROP NOT NULL
    `);

    // ── users: add phone ──
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "phone" VARCHAR DEFAULT NULL
    `);

    // ── users: add is_active ──
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true
    `);

    // ── clients: add default_lang ──
    await queryRunner.query(`
      ALTER TABLE "clients"
        ADD COLUMN IF NOT EXISTS "default_lang" VARCHAR(5) NOT NULL DEFAULT 'ru'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ── clients ──
    await queryRunner.query(`
      ALTER TABLE "clients" DROP COLUMN IF EXISTS "default_lang"
    `);

    // ── users ──
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "is_active"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "phone"
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        ALTER COLUMN "email" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP CONSTRAINT IF EXISTS "UQ_users_login"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "login"
    `);
  }
}
