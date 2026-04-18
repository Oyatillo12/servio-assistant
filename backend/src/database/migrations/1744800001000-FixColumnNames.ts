import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * TypeORM uses the property name directly as the column name (camelCase).
 * The previous migration incorrectly used snake_case names.
 * This migration renames them to match what TypeORM expects.
 *
 *   users.is_active   → users.isActive
 *   clients.default_lang → clients.defaultLang
 */
export class FixColumnNames1744800001000 implements MigrationInterface {
  name = 'FixColumnNames1744800001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        RENAME COLUMN "is_active" TO "isActive"
    `);

    await queryRunner.query(`
      ALTER TABLE "clients"
        RENAME COLUMN "default_lang" TO "defaultLang"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "clients"
        RENAME COLUMN "defaultLang" TO "default_lang"
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
        RENAME COLUMN "isActive" TO "is_active"
    `);
  }
}
