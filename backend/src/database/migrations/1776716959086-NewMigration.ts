import { MigrationInterface, QueryRunner } from 'typeorm';

export class NewMigration1776716959086 implements MigrationInterface {
  name = 'NewMigration1776716959086';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_sessions" ADD "score" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."chat_sessions_leadstatus_enum" AS ENUM('cold', 'warm', 'hot', 'closed')`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_sessions" ADD "leadStatus" "public"."chat_sessions_leadstatus_enum" NOT NULL DEFAULT 'cold'`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_sessions" ADD "isAiActive" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(`ALTER TABLE "chat_sessions" ADD "metadata" jsonb`);
    await queryRunner.query(
      `ALTER TABLE "chat_sessions" ADD "lastMessageAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_sessions" ADD "recoverySentAt" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_sessions" DROP COLUMN "recoverySentAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_sessions" DROP COLUMN "lastMessageAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_sessions" DROP COLUMN "metadata"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_sessions" DROP COLUMN "isAiActive"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_sessions" DROP COLUMN "leadStatus"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."chat_sessions_leadstatus_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "chat_sessions" DROP COLUMN "score"`);
  }
}
