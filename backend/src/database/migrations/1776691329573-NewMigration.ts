import { MigrationInterface, QueryRunner } from "typeorm";

export class NewMigration1776691329573 implements MigrationInterface {
    name = 'NewMigration1776691329573'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "clients" ADD "botToken" character varying`);
        await queryRunner.query(`ALTER TABLE "clients" ADD "botUsername" character varying`);
        await queryRunner.query(`ALTER TABLE "clients" ALTER COLUMN "type" SET DEFAULT 'lead'`);
        await queryRunner.query(`ALTER TABLE "clients" ALTER COLUMN "currency" SET DEFAULT 'UZS'`);
        await queryRunner.query(`ALTER TABLE "clients" ALTER COLUMN "defaultLang" SET DEFAULT 'uz'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "clients" ALTER COLUMN "defaultLang" SET DEFAULT 'ru'`);
        await queryRunner.query(`ALTER TABLE "clients" ALTER COLUMN "currency" SET DEFAULT 'USD'`);
        await queryRunner.query(`ALTER TABLE "clients" ALTER COLUMN "type" SET DEFAULT 'order'`);
        await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN "botUsername"`);
        await queryRunner.query(`ALTER TABLE "clients" DROP COLUMN "botToken"`);
    }

}
